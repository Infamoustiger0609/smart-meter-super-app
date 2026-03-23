from backend.database.db import SessionLocal, create_tables, User, Meter, Bill, Payment, ServiceRequest, Subscription, SolarSystem, EnergyWallet
from backend.auth.security import hash_password
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import json

IST = ZoneInfo("Asia/Kolkata")

def seed():
    create_tables()
    db = SessionLocal()
    
    try:
        # Skip if already seeded
        if db.query(User).first():
            print("Database already seeded, skipping.")
            return
        
        now = datetime.now(IST)
        
        # ── Meters (create first due to FK) ──
        meter1 = Meter(meter_id="meter_1", smart_meter_id="SM-10001", user_id=None, location="Noida Sector 62", status="ACTIVE")
        db.add(meter1)
        db.flush()
        
        # ── Users ──
        user1 = User(user_id="usr_1", full_name="Demo User", email="user@demo.com", password_hash=hash_password("demo123"), role="USER", smart_meter_id="meter_1", created_at=now.isoformat())
        admin1 = User(user_id="adm_1", full_name="Admin Operator", email="admin@demo.com", password_hash=hash_password("admin123"), role="ADMIN", smart_meter_id="meter_1", created_at=now.isoformat())
        util1 = User(user_id="util_1", full_name="Utility Operator", email="operator@demo.com", password_hash=hash_password("operator123"), role="UTILITY_OPERATOR", smart_meter_id="meter_1", created_at=now.isoformat())
        db.add_all([user1, admin1, util1])
        db.flush()
        
        # Update meter user_id
        meter1.user_id = "usr_1"
        
        # ── Bills ──
        bills = [
            Bill(bill_id="bill_1", user_id="usr_1", meter_id="meter_1", billing_month=(now - timedelta(days=60)).strftime("%Y-%m"), units_consumed=312.4, amount=1718.2, due_date=(now - timedelta(days=20)).date().isoformat(), status="PAID"),
            Bill(bill_id="bill_2", user_id="usr_1", meter_id="meter_1", billing_month=(now - timedelta(days=30)).strftime("%Y-%m"), units_consumed=287.0, amount=1594.8, due_date=(now + timedelta(days=8)).date().isoformat(), status="UNPAID"),
        ]
        db.add_all(bills)
        
        # ── Payments ──
        payment1 = Payment(payment_id="pay_1", bill_id="bill_1", user_id="usr_1", amount=1718.2, payment_method="UPI", transaction_id="TXN-DEMO-1001", payment_status="SUCCESS", payment_date=(now - timedelta(days=15)).isoformat())
        db.add(payment1)
        
        # ── Service Requests ──
        timeline = json.dumps([
            {"status": "OPEN", "note": "Request raised", "at": (now - timedelta(days=3)).isoformat()},
            {"status": "IN_PROGRESS", "note": "Assigned to field team", "at": (now - timedelta(days=1)).isoformat()}
        ])
        req1 = ServiceRequest(request_id="req_1", user_id="usr_1", meter_id="meter_1", request_type="meter malfunction", description="Meter display intermittently turns blank.", status="IN_PROGRESS", created_at=(now - timedelta(days=3)).isoformat(), updated_at=(now - timedelta(days=1)).isoformat(), timeline=timeline)
        db.add(req1)
        
        # ── Subscriptions ──
        sub1 = Subscription(subscription_id="sub_1", user_id="usr_1", plan_name="Free Plan", start_date=now.date().isoformat(), end_date=None, status="ACTIVE")
        db.add(sub1)
        
        # ── Solar ──
        solar1 = SolarSystem(system_id="solar_1", user_id="usr_1", capacity_kw=4.5, installation_date=(now - timedelta(days=300)).date().isoformat(), location="Rooftop - Block A")
        db.add(solar1)
        
        # ── Energy Wallet ──
        wallet1 = EnergyWallet(meter_id="meter_1", meter_type="PREPAID", current_balance=780.0, estimated_daily_cost=0.0, estimated_days_remaining=0.0, last_topup=(now - timedelta(days=8)).isoformat(), next_bill_estimate=0.0)
        db.add(wallet1)
        
        db.commit()
        print("Database seeded successfully.")
        
    except Exception as e:
        db.rollback()
        print(f"Seeding failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
