import os
import pytest
from datetime import datetime
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
from dashboard.database import Base, engine, SessionLocal, Product

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Add a product
    p = Product(url="https://www.target.com/p/test-product/-/A-12345")
    db.add(p)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

def test_api_to_worker_flow_simulated():
    # Fetch products to scrape
    res = client.get("/api/products", headers={"X-API-Key": "bot_secret_token"})
    assert res.status_code == 200
    products = res.json()
    assert len(products) == 1
    assert products[0]["url"] == "https://www.target.com/p/test-product/-/A-12345"
    
    # First scrape (New Listing)
    snap1 = {
        "url": "https://www.target.com/p/test-product/-/A-12345",
        "name": "Test Product 1",
        "tcin": "12345",
        "dpci": "000-00-0000",
        "upc": "111222333",
        "price": 19.99,
        "in_stock": True,
        "image_url": "https://target.scene7.com/is/image/Target/12345",
        "atc_url": "https://www.target.com/cart?item=12345",
        "purchase_limit": "2",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    update_res = client.post("/api/products/update", json=snap1, headers={"X-API-Key": "bot_secret_token"})
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "success"
    assert update_res.json()["events_generated"] >= 1 # NEW_LISTING

    # Second scrape (Price Drop and Limit Change)
    snap2 = dict(snap1)
    snap2["price"] = 14.99
    snap2["purchase_limit"] = "5"
    snap2["timestamp"] = datetime.utcnow().isoformat()

    update_res2 = client.post("/api/products/update", json=snap2, headers={"X-API-Key": "bot_secret_token"})
    assert update_res2.status_code == 200
    assert update_res2.json()["status"] == "success"
    # Should generate PRICE_CHANGE and DETAIL_UPDATE events
    assert update_res2.json()["events_generated"] >= 1 
