import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.orm import sessionmaker
import datetime

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./target_monitor.db")

# Use slightly different arguments if it's sqlite vs postgres
connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    tcin = Column(String, nullable=True)
    dpci = Column(String, nullable=True)
    upc = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    in_stock = Column(Boolean, default=False)
    image_url = Column(String, nullable=True)
    atc_url = Column(String, nullable=True)
    purchase_limit = Column(String, nullable=True)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)
    
    # New global checkout features
    profile_id = Column(Integer, ForeignKey("chrome_profiles.id"), nullable=True)
    quantity = Column(Integer, nullable=True)
    max_price = Column(Float, nullable=True)
    scheduled_time = Column(String, nullable=True)
    
    events = relationship("ChangeEvent", back_populates="product", cascade="all, delete-orphan")
    profile = relationship("ChromeProfile")

class ChangeEvent(Base):
    __tablename__ = "change_events"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    event_type = Column(String, index=True) # RESTOCK, OOS, PRICE_CHANGE, NEW_LISTING, DETAIL_UPDATE
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="events")

class Settings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    discord_webhook_url = Column(String, nullable=True)
    min_delay = Column(Integer, default=100)
    max_delay = Column(Integer, default=200)
    headless = Column(Boolean, default=True)
    proxies = Column(String, nullable=True)
    
    # Target Checkout Settings
    cvv = Column(String, nullable=True)
    target_bot_running = Column(Boolean, default=True)
    target_qty = Column(Integer, default=1)
    target_max_price = Column(Float, default=0.0)

class WalmartProduct(Base):
    __tablename__ = "walmart_products"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    in_stock = Column(Boolean, default=False)
    image_url = Column(String, nullable=True)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)
    
    # New global checkout features
    profile_id = Column(Integer, ForeignKey("chrome_profiles.id"), nullable=True)
    quantity = Column(Integer, nullable=True)
    scheduled_time = Column(String, nullable=True)
    
    events = relationship("WalmartChangeEvent", back_populates="product", cascade="all, delete-orphan")
    profile = relationship("ChromeProfile")

class WalmartChangeEvent(Base):
    __tablename__ = "walmart_change_events"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("walmart_products.id"))
    event_type = Column(String, index=True) 
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("WalmartProduct", back_populates="events")

class ChromeProfile(Base):
    __tablename__ = "chrome_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    path = Column(String, nullable=True)

class PokemonProduct(Base):
    __tablename__ = "pokemon_products"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    in_stock = Column(Boolean, default=False)
    image_url = Column(String, nullable=True)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)
    
    profile_id = Column(Integer, ForeignKey("chrome_profiles.id"), nullable=True)
    quantity = Column(Integer, nullable=True)
    scheduled_time = Column(String, nullable=True)
    
    events = relationship("PokemonChangeEvent", back_populates="product", cascade="all, delete-orphan")
    profile = relationship("ChromeProfile")

class PokemonChangeEvent(Base):
    __tablename__ = "pokemon_change_events"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("pokemon_products.id"))
    event_type = Column(String, index=True) 
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("PokemonProduct", back_populates="events")

Base.metadata.create_all(bind=engine)
