import os
import pytest
from fastapi.testclient import TestClient

os.environ["ADMIN_USER"] = "admin"
os.environ["ADMIN_PASSWORD"] = "secret"
os.environ["BOT_API_KEY"] = "bot_secret_token"
os.environ["DATABASE_URL"] = "sqlite:///./test_qa.db"
os.environ["ENCRYPTION_KEY"] = "qU6E7Fw1g9jJ4wL-3uH5_rYp2d_G8wZ1QxG4eF-v6_Y="

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dashboard"))

from dashboard.main import app, get_db
from dashboard.database import Base, engine, SessionLocal, Settings

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    from dashboard.main import encrypt_val
    settings = Settings(
        discord_webhook_url=encrypt_val("https://discord.com/api/webhooks/123/ABC"),
        proxies=encrypt_val("1.2.3.4:8080:user:pass")
    )
    db.add(settings)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

def test_fail_closed_auth():
    assert client.get("/").status_code == 401
    assert client.get("/", auth=("admin", "wrong")).status_code == 401
    assert client.get("/", auth=("admin", "secret")).status_code == 200

    assert client.get("/api/products").status_code == 401
    assert client.get("/api/products", headers={"X-API-Key": "wrong"}).status_code == 401
    assert client.get("/api/products", headers={"X-API-Key": "bot_secret_token"}).status_code == 200

def test_no_secret_exposure():
    ui_res = client.get("/", auth=("admin", "secret"))
    assert ui_res.status_code == 200
    assert "https://discord.com/api/webhooks/123/ABC" not in ui_res.text
    assert "***" in ui_res.text
    assert "1.2.3.4:8080:user:pass" not in ui_res.text

    api_res = client.get("/api/settings", headers={"X-API-Key": "bot_secret_token"})
    assert api_res.status_code == 200
    data = api_res.json()
    assert data["discordWebhookUrl"] == "https://discord.com/api/webhooks/123/ABC"
    assert data["proxies"] == "1.2.3.4:8080:user:pass"

def test_webhook_validation():
    ui_res = client.get("/", auth=("admin", "secret"))
    csrf_token = ui_res.cookies.get("csrf_token")
    
    ssrf_res = client.post(
        "/test_webhook",
        data={"discord_webhook_url": "http://169.254.169.254", "csrf_token": csrf_token},
        cookies={"csrf_token": csrf_token},
        auth=("admin", "secret")
    )
    assert ssrf_res.status_code == 200
    assert ssrf_res.json()["status"] == "error"
    assert "Invalid Discord Webhook URL" in ssrf_res.json()["message"]
