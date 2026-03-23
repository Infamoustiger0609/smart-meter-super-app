from sqlalchemy import create_engine, Column, String, Float, Boolean, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from dotenv import load_dotenv
import os

load_dotenv()


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


DATABASE_URL = _normalize_database_url(
    os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/smartmeter")
)

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Models ──────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    user_id      = Column(String, primary_key=True)
    full_name    = Column(String, nullable=False)
    email        = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role         = Column(String, default="USER")
    smart_meter_id = Column(String, ForeignKey("meters.meter_id"), nullable=True)
    created_at   = Column(String)

class Meter(Base):
    __tablename__ = "meters"
    meter_id       = Column(String, primary_key=True)
    smart_meter_id = Column(String, unique=True)
    user_id        = Column(String, ForeignKey("users.user_id"), nullable=True)
    location       = Column(String)
    status         = Column(String, default="ACTIVE")

class Bill(Base):
    __tablename__ = "bills"
    bill_id        = Column(String, primary_key=True)
    user_id        = Column(String, ForeignKey("users.user_id"))
    meter_id       = Column(String, ForeignKey("meters.meter_id"))
    billing_month  = Column(String)
    units_consumed = Column(Float)
    amount         = Column(Float)
    due_date       = Column(String)
    status         = Column(String, default="UNPAID")
    pdf_url        = Column(String, nullable=True)

class Payment(Base):
    __tablename__ = "payments"
    payment_id     = Column(String, primary_key=True)
    bill_id        = Column(String, ForeignKey("bills.bill_id"))
    user_id        = Column(String, ForeignKey("users.user_id"))
    amount         = Column(Float)
    payment_method = Column(String)
    transaction_id = Column(String)
    payment_status = Column(String)
    payment_date   = Column(String)

class ServiceRequest(Base):
    __tablename__ = "service_requests"
    request_id   = Column(String, primary_key=True)
    user_id      = Column(String, ForeignKey("users.user_id"))
    meter_id     = Column(String, ForeignKey("meters.meter_id"))
    request_type = Column(String)
    description  = Column(Text)
    status       = Column(String, default="OPEN")
    created_at   = Column(String)
    updated_at   = Column(String)
    timeline     = Column(Text)  # stored as JSON string

class Subscription(Base):
    __tablename__ = "subscriptions"
    subscription_id = Column(String, primary_key=True)
    user_id         = Column(String, ForeignKey("users.user_id"))
    plan_name       = Column(String)
    start_date      = Column(String)
    end_date        = Column(String, nullable=True)
    status          = Column(String, default="ACTIVE")

class SolarSystem(Base):
    __tablename__ = "solar_systems"
    system_id         = Column(String, primary_key=True)
    user_id           = Column(String, ForeignKey("users.user_id"))
    capacity_kw       = Column(Float)
    installation_date = Column(String)
    location          = Column(String)

class EnergyWallet(Base):
    __tablename__ = "energy_wallets"
    meter_id               = Column(String, ForeignKey("meters.meter_id"), primary_key=True)
    meter_type             = Column(String, default="PREPAID")
    current_balance        = Column(Float, default=0.0)
    estimated_daily_cost   = Column(Float, default=0.0)
    estimated_days_remaining = Column(Float, default=0.0)
    last_topup             = Column(String, nullable=True)
    next_bill_estimate     = Column(Float, default=0.0)

def create_tables():
    Base.metadata.create_all(bind=engine)
