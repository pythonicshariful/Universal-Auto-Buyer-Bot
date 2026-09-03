import json
import os
import subprocess
import uuid
from collections import deque
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException

router = APIRouter(prefix="/api/pok")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(BASE_DIR, "pok_data")
os.makedirs(DATA_DIR, exist_ok=True)

CONFIG_FILE   = os.path.join(DATA_DIR, "config.json")
PROFILES_FILE = os.path.join(DATA_DIR, "profiles.json")
PRODUCTS_FILE = os.path.join(DATA_DIR, "products.json")

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------
command_queue = []          # commands to be sent to TM script
log_buffer = deque(maxlen=300)   # recent log messages from TM script
active_product_id = None           # remembers last launched product for checkout phase
product_heartbeats = {}

DEFAULT_CONFIG = {
    "target_qty":  1,
    "min_delay":   5,
    "max_delay":   15,
    "schedule_time": "",
    "bot_running": False,
    "profile": {
        "first_name":  "",
        "last_name":   "",
        "address":     "",
        "apt":         "",
        "zip":         "",
        "phone":       "",
        "email":       ""
    },
    "payment": {
        "card_num":    "",
        "exp_month":   "08",
        "exp_year":    "2026",
        "cvv":         ""
    }
}

# ---------------------------------------------------------------------------
# Helpers — persistent JSON files
# ---------------------------------------------------------------------------
def _load_json(path: str, default):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return default.copy() if isinstance(default, dict) else list(default)


def _save_json(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_config()    -> dict: return _load_json(CONFIG_FILE,   DEFAULT_CONFIG)
def load_profiles()  -> list: return _load_json(PROFILES_FILE, [])
def load_products()  -> list: return _load_json(PRODUCTS_FILE, [])


# ---------------------------------------------------------------------------
# Chrome helpers
# ---------------------------------------------------------------------------
CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
]

def find_chrome():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    return None


def chrome_user_data_dir() -> str:
    return os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")


def launch_chrome(profile_dir: str, urls: list = None) -> dict:
    if not urls:
        urls = ["https://www.pokemoncenter.com/"]
        
    chrome = find_chrome()
    if not chrome:
        return {"ok": False, "error": "Chrome executable not found"}
    cmd = [
        chrome,
        f"--profile-directory={profile_dir}",
        "--new-window",
    ]
    cmd.extend(urls)
    try:
        subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def open_url_in_profile(profile_dir: str, url: str) -> dict:
    chrome = find_chrome()
    if not chrome:
        return {"ok": False, "error": "Chrome executable not found"}
    cmd = [
        chrome,
        f"--profile-directory={profile_dir}",
        url,
    ]
    try:
        subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Routes — Heartbeat
# ---------------------------------------------------------------------------
@router.post("/heartbeat")
async def api_heartbeat(request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    url = data.get("url")
    if url:
        product_heartbeats[url] = datetime.utcnow()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes — Config
# ---------------------------------------------------------------------------
@router.get("/config")
def api_get_config(url: str = ""):
    cfg = load_config()
    products = load_products()
    matched_product = None
    
    if url:
        matched_product = next((p for p in products if p.get("url") == url), None)
        
    if not matched_product and products:
        if active_product_id:
            matched_product = next((p for p in products if p["id"] == active_product_id), None)
        if not matched_product:
            matched_product = products[0]

    if matched_product:
        cfg["bot_running"] = matched_product.get("running", False)
        if "schedule_time" in matched_product:
            cfg["schedule_time"] = matched_product["schedule_time"]
            
        if "shipping" in matched_product:
            cfg["profile"] = matched_product["shipping"]
        if "payment" in matched_product:
            cfg["payment"] = matched_product["payment"]
        if matched_product.get("target_qty") not in (None, ""):
            cfg["target_qty"] = matched_product["target_qty"]
        if matched_product.get("max_price") not in (None, ""):
            cfg["max_price"] = matched_product["max_price"]
                
    return cfg


@router.post("/config")
async def api_set_config(request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    cfg  = load_config()

    for key in ("target_qty", "min_delay", "max_delay", "schedule_time", "bot_running"):
        if key in data:
            cfg[key] = data[key]

    if "profile" in data and isinstance(data["profile"], dict):
        cfg.setdefault("profile", {}).update(data["profile"])

    if "payment" in data and isinstance(data["payment"], dict):
        cfg.setdefault("payment", {}).update(data["payment"])

    _save_json(CONFIG_FILE, cfg)
    return {"ok": True, "config": cfg}


# ---------------------------------------------------------------------------
# Routes — Commands
# ---------------------------------------------------------------------------
@router.get("/commands")
def api_get_commands():
    pending = list(command_queue)
    command_queue.clear()
    return {"commands": pending}


@router.post("/commands")
async def api_post_command(request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    cmd  = data.get("cmd")
    if not cmd:
        return {"ok": False, "error": "Missing 'cmd' field"}

    payload = {"cmd": cmd, "ts": datetime.utcnow().isoformat()}
    if cmd == "navigate" and "url" in data:
        payload["url"] = data["url"]

    command_queue.append(payload)

    if cmd in ["start", "stop"]:
        cfg = load_config()
        cfg["bot_running"] = (cmd == "start")
        _save_json(CONFIG_FILE, cfg)
        
        products = load_products()
        for p in products:
            p["running"] = (cmd == "start")
        _save_json(PRODUCTS_FILE, products)

    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes — Logs
# ---------------------------------------------------------------------------
@router.post("/log")
async def api_post_log(request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    entry = {
        "ts":      datetime.utcnow().strftime("%H:%M:%S"),
        "level":   data.get("level", "info"),
        "message": data.get("message", ""),
    }
    log_buffer.append(entry)
    return {"ok": True}


@router.get("/logs")
def api_get_logs():
    return {"logs": list(log_buffer)}


@router.post("/logs/clear")
def api_clear_logs():
    log_buffer.clear()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes — Status
# ---------------------------------------------------------------------------
@router.get("/status")
def api_status():
    cfg = load_config()
    return {
        "bot_running":  cfg.get("bot_running", False),
        "chrome_found": find_chrome() is not None,
        "chrome_path":  find_chrome(),
        "port":         8000,
    }


# ---------------------------------------------------------------------------
# Routes — Chrome Profiles
# ---------------------------------------------------------------------------
@router.get("/local-profiles")
def api_get_local_profiles():
    local_state_path = os.path.join(chrome_user_data_dir(), "Local State")
    found_profiles = []
    if os.path.exists(local_state_path):
        try:
            with open(local_state_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                info_cache = data.get("profile", {}).get("info_cache", {})
                for dir_name, info in info_cache.items():
                    name = info.get("name", dir_name)
                    if dir_name not in ("System Profile", "Guest Profile"):
                        found_profiles.append({"dir_name": dir_name, "name": name})
        except Exception:
            pass
    return {"local_profiles": found_profiles}


@router.get("/profiles")
def api_get_profiles():
    return {"profiles": load_profiles()}


@router.post("/profiles")
async def api_add_profile(request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    name     = (data.get("name") or "").strip()
    dir_name = (data.get("dir_name") or "").strip()

    if not name or not dir_name:
        return {"ok": False, "error": "name and dir_name required"}

    profiles = load_profiles()
    entry = {"id": str(uuid.uuid4()), "name": name, "dir_name": dir_name}
    profiles.append(entry)
    _save_json(PROFILES_FILE, profiles)
    return {"ok": True, "profile": entry}


@router.delete("/profiles/{profile_id}")
def api_delete_profile(profile_id: str):
    profiles = [p for p in load_profiles() if p["id"] != profile_id]
    _save_json(PROFILES_FILE, profiles)
    return {"ok": True}


@router.post("/profiles/{profile_id}/launch")
async def api_launch_profile(profile_id: str, request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    urls = data.get("urls", [])

    profile = next((p for p in load_profiles() if p["id"] == profile_id), None)
    if not profile:
        return {"ok": False, "error": "Profile not found"}

    result = launch_chrome(profile["dir_name"], urls)
    return result


# ---------------------------------------------------------------------------
# Routes — Products
# ---------------------------------------------------------------------------
@router.get("/products")
def api_get_products():
    products = load_products()
    now = datetime.utcnow()
    for p in products:
        url = p.get("url")
        is_open = False
        if url:
            for hb_url, hb_time in product_heartbeats.items():
                if url in hb_url or hb_url in url:
                    if (now - hb_time).total_seconds() < 15:
                        is_open = True
                        break
        p["is_open"] = is_open
        
    return {"products": products}


@router.post("/products")
async def api_add_product(request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    url        = (data.get("url") or "").strip()
    label      = (data.get("label") or url).strip()
    profile_id = data.get("profile_id") or None
    shipping   = data.get("shipping", {})
    payment    = data.get("payment", {})
    target_qty = data.get("target_qty")
    max_price  = data.get("max_price")

    if not url:
        return {"ok": False, "error": "url required"}

    products = load_products()
    entry = {
        "id": str(uuid.uuid4()), 
        "url": url, 
        "label": label, 
        "profile_id": profile_id,
        "shipping": shipping,
        "payment": payment,
        "target_qty": target_qty,
        "max_price": max_price
    }
    products.append(entry)
    _save_json(PRODUCTS_FILE, products)
    return {"ok": True, "product": entry}


@router.put("/products/{product_id}")
async def api_update_product(product_id: str, request: Request):
    try:
        data = await request.json()
    except:
        data = {}
    products   = load_products()
    
    product = next((p for p in products if p["id"] == product_id), None)
    if not product:
        return {"ok": False, "error": "product not found"}
        
    if "label" in data:
        product["label"] = data["label"].strip()
    if "profile_id" in data:
        product["profile_id"] = data["profile_id"]
    if "shipping" in data:
        product["shipping"] = data["shipping"]
    if "payment" in data:
        product["payment"] = data["payment"]
    if "target_qty" in data:
        product["target_qty"] = data["target_qty"]
    if "max_price" in data:
        product["max_price"] = data["max_price"]
        
    _save_json(PRODUCTS_FILE, products)
    return {"ok": True, "product": product}


@router.post("/products/{product_id}/start")
def api_product_start(product_id: str):
    products = load_products()
    for p in products:
        if p["id"] == product_id:
            p["running"] = True
            break
    _save_json(PRODUCTS_FILE, products)
    return {"ok": True}

@router.post("/products/{product_id}/stop")
def api_product_stop(product_id: str):
    products = load_products()
    for p in products:
        if p["id"] == product_id:
            p["running"] = False
            break
    _save_json(PRODUCTS_FILE, products)
    return {"ok": True}

@router.delete("/products/{product_id}")
def api_delete_product(product_id: str):
    products = [p for p in load_products() if p["id"] != product_id]
    _save_json(PRODUCTS_FILE, products)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes — Open URL
# ---------------------------------------------------------------------------
@router.post("/open-url")
async def api_open_url(request: Request):
    global active_product_id
    try:
        data = await request.json()
    except:
        data = {}
    url        = (data.get("url") or "").strip()
    profile_id = data.get("profile_id")
    product_id = data.get("product_id")

    if not url:
        return {"ok": False, "error": "url required"}

    if product_id:
        active_product_id = product_id

    profiles = load_profiles()
    profile  = next((p for p in profiles if p["id"] == profile_id), None)

    if not profile:
        result = open_url_in_profile("Default", url)
    else:
        result = open_url_in_profile(profile["dir_name"], url)

    command_queue.append({"cmd": "navigate", "url": url, "ts": datetime.utcnow().isoformat()})
    return result
