from fastapi import FastAPI, Depends, Request, Form, HTTPException, status, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials, APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import time
import asyncio
import secrets

global_last_update = time.time()
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import SessionLocal, Product, Settings, ChangeEvent as DBChangeEvent, WalmartProduct, WalmartChangeEvent, engine
from pydantic import BaseModel
import datetime
import os
import sys
import httpx
from cryptography.fernet import Fernet, InvalidToken

# Add parent dir to path so we can import connector
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from connector.models import ProductSnapshot, ChangeEvent
from connector.utils import diff_snapshots

import pok_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pok_router.router)

templates_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
templates = Jinja2Templates(directory=templates_dir)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# --- Security Setup ---
security_basic = HTTPBasic()
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()


ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
fernet = Fernet(ENCRYPTION_KEY)

def encrypt_val(val: str) -> str:
    if not val: return val
    try:
        return fernet.encrypt(val.encode()).decode()
    except Exception:
        return val

def decrypt_val(val: str) -> str:
    if not val: return val
    try:
        return fernet.decrypt(val.encode()).decode()
    except InvalidToken:
        return val

def mask_webhook(url: str) -> str:
    if not url: return url
    if len(url) > 20:
        return url[:32] + "***"
    return "***"

def mask_proxies(proxies: str) -> str:
    if not proxies: return proxies
    return "\n".join(["***" if p.strip() else "" for p in proxies.split("\n")])

def verify_csrf(request: Request, csrf_token: str = Form(...)):
    pass

def verify_basic_auth(credentials: HTTPBasicCredentials = Depends(security_basic)):
    admin_user = os.getenv("ADMIN_USER", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin")
    correct_username = secrets.compare_digest(credentials.username, admin_user)
    correct_password = secrets.compare_digest(credentials.password, admin_pass)
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

def verify_api_key(api_key: str = Depends(api_key_header)):
    bot_api_key = os.getenv("BOT_API_KEY")
    if bot_api_key:
        if not api_key or not secrets.compare_digest(api_key, bot_api_key):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API Key")
    return api_key

# Safe migrations
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE settings ADD COLUMN proxies TEXT"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        # products
        conn.execute(text("ALTER TABLE products ADD COLUMN profile_id INTEGER"))
        conn.execute(text("ALTER TABLE products ADD COLUMN quantity INTEGER"))
        conn.execute(text("ALTER TABLE products ADD COLUMN scheduled_time TEXT"))
        # walmart_products
        conn.execute(text("ALTER TABLE walmart_products ADD COLUMN profile_id INTEGER"))
        conn.execute(text("ALTER TABLE walmart_products ADD COLUMN quantity INTEGER"))
        conn.execute(text("ALTER TABLE walmart_products ADD COLUMN scheduled_time TEXT"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE products ADD COLUMN max_price FLOAT"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE settings ADD COLUMN cvv TEXT"))
        conn.execute(text("ALTER TABLE settings ADD COLUMN target_bot_running BOOLEAN"))
        conn.execute(text("ALTER TABLE settings ADD COLUMN target_qty INTEGER"))
        conn.execute(text("ALTER TABLE settings ADD COLUMN target_max_price FLOAT"))
except Exception:
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_settings(db: Session):
    settings = db.query(Settings).first()
    if not settings:
        settings = Settings(
            discord_webhook_url="",
            min_delay=100,
            max_delay=200,
            headless=True,
            proxies="",
            cvv="",
            target_bot_running=True,
            target_qty=1,
            target_max_price=0.0
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/pokemon", response_class=HTMLResponse)
async def read_pokemon(request: Request):
    return templates.TemplateResponse(request=request, name="pok_index.html", context={})

@app.get("/", response_class=HTMLResponse)
def read_dashboard(request: Request, db: Session = Depends(get_db), user: str = Depends(verify_basic_auth)):
    products = db.query(Product).order_by(Product.id.asc()).all()
    walmart_products = db.query(WalmartProduct).order_by(WalmartProduct.id.asc()).all()
    from database import PokemonProduct, PokemonChangeEvent, ChromeProfile
    pokemon_products = db.query(PokemonProduct).order_by(PokemonProduct.id.asc()).all()
    
    # Load last 10 events for display
    recent_events = db.query(DBChangeEvent).order_by(DBChangeEvent.timestamp.desc()).limit(15).all()
    walmart_recent_events = db.query(WalmartChangeEvent).order_by(WalmartChangeEvent.timestamp.desc()).limit(15).all()
    pokemon_recent_events = db.query(PokemonChangeEvent).order_by(PokemonChangeEvent.timestamp.desc()).limit(15).all()
    
    chrome_profiles = db.query(ChromeProfile).all()
    
    settings = get_settings(db)
    
    decrypted_webhook = decrypt_val(settings.discord_webhook_url)
    decrypted_proxies = decrypt_val(settings.proxies)
    
    masked_settings = {
        "discord_webhook_url": mask_webhook(decrypted_webhook),
        "min_delay": settings.min_delay,
        "max_delay": settings.max_delay,
        "headless": settings.headless,
        "proxies": mask_proxies(decrypted_proxies)
    }
    
    csrf_token = secrets.token_urlsafe(32)
    response = templates.TemplateResponse(request=request, name="index.html", context={
        "products": products, 
        "walmart_products": walmart_products,
        "pokemon_products": pokemon_products,
        "settings": masked_settings,
        "recent_events": recent_events,
        "walmart_recent_events": walmart_recent_events,
        "pokemon_recent_events": pokemon_recent_events,
        "chrome_profiles": chrome_profiles,
        "csrf_token": csrf_token
    })
    response.set_cookie("csrf_token", csrf_token, httponly=True, samesite="lax")
    return response

@app.post("/add_product")
def add_product(request: Request, url: str = Form(...), quantity: int = Form(1), max_price: float = Form(0.0), db: Session = Depends(get_db), user: str = Depends(verify_basic_auth), _: None = Depends(verify_csrf)):
    if not db.query(Product).filter(Product.url == url).first():
        new_product = Product(url=url, quantity=quantity, max_price=max_price)
        
        # Try to extract TCIN immediately
        import re
        m = re.search(r'/-/A-([0-9]+)', url) or re.search(r'[?&]tcin=([0-9]+)', url)
        if m:
            new_product.tcin = m.group(1)
            
        db.add(new_product)
        db.commit()
    return RedirectResponse(url="/", status_code=303)

@app.post("/update_product/{product_id}")
def update_product(request: Request, product_id: int, quantity: int = Form(1), max_price: float = Form(0.0), db: Session = Depends(get_db), user: str = Depends(verify_basic_auth), _: None = Depends(verify_csrf)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if p:
        p.quantity = quantity
        p.max_price = max_price
        db.commit()
    return RedirectResponse(url="/", status_code=303)

@app.post("/walmart/add_product")
def walmart_add_product(request: Request, url: str = Form(...), profile_id: int = Form(None), quantity: int = Form(None), db: Session = Depends(get_db), user: str = Depends(verify_basic_auth), _: None = Depends(verify_csrf)):
    if not db.query(WalmartProduct).filter(WalmartProduct.url == url).first():
        new_product = WalmartProduct(url=url, profile_id=profile_id, quantity=quantity)
        db.add(new_product)
        db.commit()
    return RedirectResponse(url="/", status_code=303)

@app.post("/pokemon/add_product")
def pokemon_add_product(request: Request, url: str = Form(...), profile_id: int = Form(None), quantity: int = Form(None), db: Session = Depends(get_db), user: str = Depends(verify_basic_auth), _: None = Depends(verify_csrf)):
    from database import PokemonProduct
    if not db.query(PokemonProduct).filter(PokemonProduct.url == url).first():
        new_product = PokemonProduct(url=url, profile_id=profile_id, quantity=quantity)
        db.add(new_product)
        db.commit()
    return RedirectResponse(url="/", status_code=303)

@app.post("/delete_product/{product_id}")
def delete_product(request: Request, product_id: int, db: Session = Depends(get_db), user: str = Depends(verify_basic_auth), _: None = Depends(verify_csrf)):
    db.query(Product).filter(Product.id == product_id).delete()
    db.commit()
    return RedirectResponse(url="/", status_code=303)

@app.post("/walmart/delete_product/{product_id}")
def walmart_delete_product(request: Request, product_id: int, db: Session = Depends(get_db), user: str = Depends(verify_basic_auth), _: None = Depends(verify_csrf)):
    db.query(WalmartProduct).filter(WalmartProduct.id == product_id).delete()
    db.commit()
    return RedirectResponse(url="/", status_code=303)

@app.post("/update_settings")
def update_settings(
    request: Request,
    discord_webhook_url: str = Form(""),
    min_delay: int = Form(100),
    max_delay: int = Form(200),
    headless: bool = Form(False),
    proxies: str = Form(""),
    cvv: str = Form(""),
    target_bot_running: bool = Form(False),
    target_qty: int = Form(1),
    target_max_price: float = Form(0.0),
    db: Session = Depends(get_db),
    user: str = Depends(verify_basic_auth),
    _: None = Depends(verify_csrf)
):
    settings = get_settings(db)
    if "***" not in discord_webhook_url:
        settings.discord_webhook_url = encrypt_val(discord_webhook_url)
    if "***" not in proxies:
        settings.proxies = encrypt_val(proxies)
        
    settings.min_delay = min_delay
    settings.max_delay = max_delay
    settings.headless = headless
    if cvv and "***" not in cvv:
        settings.cvv = encrypt_val(cvv)
    settings.target_bot_running = target_bot_running
    settings.target_qty = target_qty
    settings.target_max_price = target_max_price
    db.commit()
    return RedirectResponse(url="/", status_code=303)

@app.post("/api/target/toggle_bot")
def toggle_target_bot(request: Request, db: Session = Depends(get_db)):
    settings = get_settings(db)
    settings.target_bot_running = not (settings.target_bot_running if settings.target_bot_running is not None else False)
    db.commit()
    return {"bot_running": settings.target_bot_running}

@app.get("/api/target/config")
def get_target_bot_config(url: str = "", db: Session = Depends(get_db)):
    settings = get_settings(db)
    products = db.query(Product).all()
    
    prod_list = []
    matched_product = None
    normalized_url = url.split("?")[0].rstrip("/") if url else ""
    
    for p in products:
        p_dict = {
            "id": p.id,
            "url": p.url,
            "name": p.name,
            "tcin": p.tcin,
            "price": p.price,
            "in_stock": p.in_stock,
            "quantity": p.quantity or settings.target_qty or 1,
            "max_price": p.max_price if p.max_price is not None else (settings.target_max_price or 0.0),
            "atc_url": p.atc_url
        }
        prod_list.append(p_dict)
        
        if url:
            if (p.url and p.url.split("?")[0].rstrip("/") == normalized_url) or (p.tcin and p.tcin in url):
                matched_product = p_dict
                
    return {
        "bot_running": settings.target_bot_running if settings.target_bot_running is not None else True,
        "settings": {
            "min_delay": settings.min_delay,
            "max_delay": settings.max_delay,
            "cvv": decrypt_val(settings.cvv) or "123",
            "default_qty": settings.target_qty or 1,
            "default_max_price": settings.target_max_price or 0.0
        },
        "products": prod_list,
        "matched_product": matched_product
    }


# --- API Endpoints ---

@app.get("/api/stream")
async def stream_events(request: Request, user: str = Depends(verify_basic_auth)):
    async def event_generator():
        last_seen = time.time()
        while True:
            if await request.is_disconnected():
                break
            if global_last_update > last_seen:
                last_seen = global_last_update
                yield "data: update\n\n"
            await asyncio.sleep(0.5)
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/products")
def get_api_products(db: Session = Depends(get_db), api_key: str = Depends(verify_api_key)):
    products = db.query(Product).all()
    result = []
    for p in products:
        result.append({
            "url": p.url,
            "name": p.name,
            "price": p.price,
            "in_stock": p.in_stock,
            "tcin": p.tcin,
            "dpci": p.dpci,
            "upc": p.upc,
            "purchase_limit": p.purchase_limit,
            "image_url": p.image_url,
            "atc_url": p.atc_url,
            "profile_id": p.profile_id,
            "quantity": p.quantity,
            "scheduled_time": p.scheduled_time
        })
    return result

@app.get("/api/walmart/products")
def get_api_walmart_products(db: Session = Depends(get_db), api_key: str = Depends(verify_api_key)):
    products = db.query(WalmartProduct).all()
    result = []
    for p in products:
        result.append({
            "url": p.url,
            "name": p.name,
            "price": p.price,
            "in_stock": p.in_stock,
            "image_url": p.image_url,
            "profile_id": p.profile_id,
            "quantity": p.quantity,
            "scheduled_time": p.scheduled_time
        })
    return result

@app.get("/api/pokemon/products")
def get_api_pokemon_products(db: Session = Depends(get_db), api_key: str = Depends(verify_api_key)):
    from database import PokemonProduct
    products = db.query(PokemonProduct).all()
    result = []
    for p in products:
        result.append({
            "url": p.url,
            "name": p.name,
            "price": p.price,
            "in_stock": p.in_stock,
            "image_url": p.image_url,
            "profile_id": p.profile_id,
            "quantity": p.quantity,
            "scheduled_time": p.scheduled_time
        })
    return result

@app.get("/api/chrome_profiles")
def get_api_chrome_profiles(db: Session = Depends(get_db), api_key: str = Depends(verify_api_key)):
    from database import ChromeProfile
    profiles = db.query(ChromeProfile).all()
    result = []
    for p in profiles:
        result.append({
            "id": p.id,
            "name": p.name,
            "path": p.path
        })
    return result

@app.get("/api/local_profiles")
def get_api_local_profiles(db: Session = Depends(get_db), user: str = Depends(verify_basic_auth)):
    def chrome_user_data_dir() -> str:
        return os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")
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
                        found_profiles.append({"dir_name": dir_name, "name": name, "path": os.path.join(chrome_user_data_dir(), dir_name)})
        except Exception:
            pass
    return {"local_profiles": found_profiles}

@app.post("/api/chrome_profiles/add")
def api_add_chrome_profile(request: Request, name: str = Form(...), path: str = Form(...), db: Session = Depends(get_db), user: str = Depends(verify_basic_auth), _: None = Depends(verify_csrf)):
    from database import ChromeProfile
    if not db.query(ChromeProfile).filter(ChromeProfile.name == name).first():
        new_profile = ChromeProfile(name=name, path=path)
        db.add(new_profile)
        db.commit()
    return RedirectResponse(url="/", status_code=303)

@app.get("/api/settings")
def get_api_settings(db: Session = Depends(get_db), api_key: str = Depends(verify_api_key)):
    settings = get_settings(db)
    # DB/UI value takes priority; env var is only a fallback if DB is empty
    discord_webhook = settings.discord_webhook_url or os.getenv("DISCORD_WEBHOOK_URL", "")
    decrypted_webhook = decrypt_val(discord_webhook)
    decrypted_proxies = decrypt_val(settings.proxies)
    return {
        "discordWebhookUrl": decrypted_webhook,
        "minDelay": settings.min_delay,
        "maxDelay": settings.max_delay,
        "headless": settings.headless,
        "proxies": decrypted_proxies or ""
    }

@app.post("/api/products/update")
def update_api_product(snapshot: ProductSnapshot, background_tasks: BackgroundTasks, db: Session = Depends(get_db), api_key: str = Depends(verify_api_key)):
    product = db.query(Product).filter(Product.url == snapshot.url).first()
    if not product:
        return {"error": "Product not found"}
        
    # Build old snapshot from DB state for diffing
    old_snapshot = None
    if product.name or product.price or product.last_updated: # if it has been updated before
        old_snapshot = ProductSnapshot(
            url=product.url,
            name=product.name,
            tcin=product.tcin,
            dpci=product.dpci,
            upc=product.upc,
            price=product.price,
            in_stock=product.in_stock or False,
            image_url=product.image_url,
            atc_url=product.atc_url,
            purchase_limit=product.purchase_limit,
            timestamp=product.last_updated or datetime.datetime.utcnow()
        )
        
    # Compare and generate events
    events = diff_snapshots(old_snapshot, snapshot)
    
    # Save new state
    product.name = snapshot.name or product.name
    product.price = snapshot.price if snapshot.price is not None else product.price
    product.tcin = snapshot.tcin or product.tcin
    product.dpci = snapshot.dpci or product.dpci
    product.upc = snapshot.upc or product.upc
    product.in_stock = snapshot.in_stock
    product.image_url = snapshot.image_url or product.image_url
    product.atc_url = snapshot.atc_url or product.atc_url
    product.purchase_limit = snapshot.purchase_limit or product.purchase_limit
    product.last_updated = datetime.datetime.utcnow()
    
    global global_last_update
    global_last_update = time.time()
    
    restocked = False

    # Save events
    for ev in events:
        if ev.event_type == "RESTOCK" or (ev.event_type == "NEW_LISTING" and snapshot.in_stock):
            restocked = True
        db_event = DBChangeEvent(
            product_id=product.id,
            event_type=ev.event_type,
            old_value=ev.old_value,
            new_value=ev.new_value,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(db_event)
        
    db.commit()
    
    if restocked:
        background_tasks.add_task(
            manager.broadcast,
            {"action": "RESTOCK", "url": snapshot.url, "atc_url": snapshot.atc_url}
        )
    
    return {
        "status": "success",
        "events_generated": len(events)
    }

@app.post("/api/walmart/products/update")
def update_api_walmart_product(snapshot: ProductSnapshot, background_tasks: BackgroundTasks, db: Session = Depends(get_db), api_key: str = Depends(verify_api_key)):
    product = db.query(WalmartProduct).filter(WalmartProduct.url == snapshot.url).first()
    if not product:
        return {"error": "Walmart Product not found"}
        
    old_snapshot = None
    if product.name or product.price or product.last_updated:
        old_snapshot = ProductSnapshot(
            url=product.url,
            name=product.name,
            price=product.price,
            in_stock=product.in_stock or False,
            image_url=product.image_url,
            timestamp=product.last_updated or datetime.datetime.utcnow()
        )
        
    events = diff_snapshots(old_snapshot, snapshot)
    
    product.name = snapshot.name or product.name
    product.price = snapshot.price if snapshot.price is not None else product.price
    product.in_stock = snapshot.in_stock
    product.image_url = snapshot.image_url or product.image_url
    product.last_updated = datetime.datetime.utcnow()
    
    global global_last_update
    global_last_update = time.time()
    
    restocked = False
    for ev in events:
        if ev.event_type == "RESTOCK" or (ev.event_type == "NEW_LISTING" and snapshot.in_stock):
            restocked = True
        db_event = WalmartChangeEvent(
            product_id=product.id,
            event_type=ev.event_type,
            old_value=ev.old_value,
            new_value=ev.new_value,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(db_event)
        
    db.commit()
    
    if restocked:
        background_tasks.add_task(
            manager.broadcast,
            {"action": "RESTOCK", "url": snapshot.url}
        )
    
    return {
        "status": "success",
        "events_generated": len(events)
    }

@app.post("/api/pokemon/products/update")
def update_api_pokemon_product(snapshot: ProductSnapshot, background_tasks: BackgroundTasks, db: Session = Depends(get_db), api_key: str = Depends(verify_api_key)):
    from database import PokemonProduct, PokemonChangeEvent
    product = db.query(PokemonProduct).filter(PokemonProduct.url == snapshot.url).first()
    if not product:
        return {"error": "Pokemon Product not found"}
        
    old_snapshot = None
    if product.name or product.price or product.last_updated:
        old_snapshot = ProductSnapshot(
            url=product.url,
            name=product.name,
            price=product.price,
            in_stock=product.in_stock or False,
            image_url=product.image_url,
            timestamp=product.last_updated or datetime.datetime.utcnow()
        )
        
    events = diff_snapshots(old_snapshot, snapshot)
    
    product.name = snapshot.name or product.name
    product.price = snapshot.price if snapshot.price is not None else product.price
    product.in_stock = snapshot.in_stock
    product.image_url = snapshot.image_url or product.image_url
    product.last_updated = datetime.datetime.utcnow()
    
    global global_last_update
    global_last_update = time.time()
    
    restocked = False
    for ev in events:
        if ev.event_type == "RESTOCK" or (ev.event_type == "NEW_LISTING" and snapshot.in_stock):
            restocked = True
        db_event = PokemonChangeEvent(
            product_id=product.id,
            event_type=ev.event_type,
            old_value=ev.old_value,
            new_value=ev.new_value,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(db_event)
        
    db.commit()
    
    if restocked:
        background_tasks.add_task(
            manager.broadcast,
            {"action": "RESTOCK", "url": snapshot.url}
        )
    
    return {
        "status": "success",
        "events_generated": len(events)
    }

import urllib.request
import json

@app.post("/test_webhook")
async def test_webhook(request: Request, discord_webhook_url: str = Form(...), user: str = Depends(verify_basic_auth), _: None = Depends(verify_csrf)):
    if not discord_webhook_url:
        return {"status": "error", "message": "No webhook URL provided"}
        
    if not discord_webhook_url.startswith("https://discord.com/api/webhooks/"):
        return {"status": "error", "message": "Invalid Discord Webhook URL. It must be a valid https://discord.com/api/webhooks/... URL."}
        
    try:
        data = {
            "embeds": [{
                "title": "✅ Webhook Test Successful!",
                "description": "Your Target Monitor Bot is successfully connected to this Discord channel.",
                "color": 65280,
                "timestamp": datetime.datetime.utcnow().isoformat()
            }]
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                discord_webhook_url, 
                json=data, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TargetMonitor/1.0'},
                follow_redirects=False,
                timeout=5.0
            )
            resp.raise_for_status()
            
        return {"status": "success", "message": "Test webhook sent successfully!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

