from __future__ import annotations
from backend.database.db import SessionLocal, User, Meter, Bill, Payment, ServiceRequest, Subscription, SolarSystem, EnergyWallet
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

class PostgresStore:
    
    def next_id(self, prefix: str) -> str:
        import time, random
        return f"{prefix}_{int(time.time())}_{random.randint(100,999)}"
    
    def _db(self):
        return SessionLocal()
    
    # ── USERS ──────────────────────────────────────────
    @property
    def users(self):
        db = self._db()
        try:
            rows = db.query(User).all()
            return {u.user_id: self._user_to_dict(u) for u in rows}
        finally:
            db.close()

    def get_user_by_email(self, email: str):
        db = self._db()
        try:
            u = db.query(User).filter(User.email == email.lower()).first()
            return self._user_to_dict(u) if u else None
        finally:
            db.close()

    def get_user(self, user_id: str):
        db = self._db()
        try:
            u = db.query(User).filter(User.user_id == user_id).first()
            return self._user_to_dict(u) if u else None
        finally:
            db.close()

    def add_user(self, user: dict):
        db = self._db()
        try:
            u = User(**{k: v for k, v in user.items() if k != 'password_hash'}, password_hash=user.get('password_hash', ''))
            db.add(u)
            db.commit()
        finally:
            db.close()

    def _user_to_dict(self, u):
        if not u: return None
        return {"user_id": u.user_id, "full_name": u.full_name, "email": u.email, "password_hash": u.password_hash, "role": u.role, "smart_meter_id": u.smart_meter_id, "created_at": u.created_at}

    def clone_user_safe(self, user: dict) -> dict:
        u = dict(user)
        u.pop("password_hash", None)
        return u

    # ── METERS ─────────────────────────────────────────
    @property
    def meters(self):
        db = self._db()
        try:
            rows = db.query(Meter).all()
            return {m.meter_id: self._meter_to_dict(m) for m in rows}
        finally:
            db.close()

    def get_meter(self, meter_id: str):
        db = self._db()
        try:
            m = db.query(Meter).filter(Meter.meter_id == meter_id).first()
            return self._meter_to_dict(m) if m else None
        finally:
            db.close()

    def add_meter(self, meter: dict):
        db = self._db()
        try:
            m = Meter(**meter)
            db.add(m)
            db.commit()
        finally:
            db.close()

    def _meter_to_dict(self, m):
        if not m: return None
        return {"meter_id": m.meter_id, "smart_meter_id": m.smart_meter_id, "user_id": m.user_id, "location": m.location, "status": m.status}

    # ── BILLS ──────────────────────────────────────────
    @property
    def bills(self):
        db = self._db()
        try:
            rows = db.query(Bill).all()
            return {b.bill_id: self._bill_to_dict(b) for b in rows}
        finally:
            db.close()

    def get_bill(self, bill_id: str):
        db = self._db()
        try:
            b = db.query(Bill).filter(Bill.bill_id == bill_id).first()
            return self._bill_to_dict(b) if b else None
        finally:
            db.close()

    def add_bill(self, bill: dict):
        db = self._db()
        try:
            b = Bill(**bill)
            db.add(b)
            db.commit()
        finally:
            db.close()

    def update_bill_status(self, bill_id: str, status: str):
        db = self._db()
        try:
            b = db.query(Bill).filter(Bill.bill_id == bill_id).first()
            if b:
                b.status = status
                db.commit()
        finally:
            db.close()

    def _bill_to_dict(self, b):
        if not b: return None
        return {"bill_id": b.bill_id, "user_id": b.user_id, "meter_id": b.meter_id, "billing_month": b.billing_month, "units_consumed": b.units_consumed, "amount": b.amount, "due_date": b.due_date, "status": b.status, "pdf_url": b.pdf_url}

    # ── PAYMENTS ───────────────────────────────────────
    @property
    def payments(self):
        db = self._db()
        try:
            rows = db.query(Payment).all()
            return {p.payment_id: self._payment_to_dict(p) for p in rows}
        finally:
            db.close()

    def add_payment(self, payment: dict):
        db = self._db()
        try:
            p = Payment(**payment)
            db.add(p)
            db.commit()
        finally:
            db.close()

    def _payment_to_dict(self, p):
        if not p: return None
        return {"payment_id": p.payment_id, "bill_id": p.bill_id, "user_id": p.user_id, "amount": p.amount, "payment_method": p.payment_method, "transaction_id": p.transaction_id, "payment_status": p.payment_status, "payment_date": p.payment_date}

    # ── SERVICE REQUESTS ───────────────────────────────
    @property
    def service_requests(self):
        db = self._db()
        try:
            rows = db.query(ServiceRequest).all()
            return {r.request_id: self._req_to_dict(r) for r in rows}
        finally:
            db.close()

    def get_service_request(self, request_id: str):
        db = self._db()
        try:
            r = db.query(ServiceRequest).filter(ServiceRequest.request_id == request_id).first()
            return self._req_to_dict(r) if r else None
        finally:
            db.close()

    def add_service_request(self, req: dict):
        db = self._db()
        try:
            r = ServiceRequest(**{**req, "timeline": json.dumps(req.get("timeline", []))})
            db.add(r)
            db.commit()
        finally:
            db.close()

    def update_service_request(self, request_id: str, status: str, timeline: list):
        db = self._db()
        try:
            r = db.query(ServiceRequest).filter(ServiceRequest.request_id == request_id).first()
            if r:
                r.status = status
                r.timeline = json.dumps(timeline)
                r.updated_at = datetime.now(IST).isoformat()
                db.commit()
        finally:
            db.close()

    def _req_to_dict(self, r):
        if not r: return None
        return {"request_id": r.request_id, "user_id": r.user_id, "meter_id": r.meter_id, "request_type": r.request_type, "description": r.description, "status": r.status, "created_at": r.created_at, "updated_at": r.updated_at, "timeline": json.loads(r.timeline or "[]")}

    # ── SUBSCRIPTIONS ──────────────────────────────────
    @property
    def subscriptions(self):
        db = self._db()
        try:
            rows = db.query(Subscription).all()
            return {s.subscription_id: self._sub_to_dict(s) for s in rows}
        finally:
            db.close()

    def get_subscription(self, user_id: str):
        db = self._db()
        try:
            s = db.query(Subscription).filter(Subscription.user_id == user_id, Subscription.status == "ACTIVE").first()
            return self._sub_to_dict(s) if s else None
        finally:
            db.close()

    def update_subscription(self, user_id: str, plan_name: str):
        db = self._db()
        try:
            s = db.query(Subscription).filter(Subscription.user_id == user_id).first()
            if s:
                s.plan_name = plan_name
                db.commit()
        finally:
            db.close()

    def _sub_to_dict(self, s):
        if not s: return None
        return {"subscription_id": s.subscription_id, "user_id": s.user_id, "plan_name": s.plan_name, "start_date": s.start_date, "end_date": s.end_date, "status": s.status}

    # ── SOLAR ──────────────────────────────────────────
    @property
    def solar_systems(self):
        db = self._db()
        try:
            rows = db.query(SolarSystem).all()
            return {s.system_id: {"system_id": s.system_id, "user_id": s.user_id, "capacity_kw": s.capacity_kw, "installation_date": s.installation_date, "location": s.location} for s in rows}
        finally:
            db.close()

    # ── ENERGY WALLET ──────────────────────────────────
    @property
    def energy_wallets(self):
        db = self._db()
        try:
            rows = db.query(EnergyWallet).all()
            return {w.meter_id: {"meter_id": w.meter_id, "meter_type": w.meter_type, "current_balance": w.current_balance, "estimated_daily_cost": w.estimated_daily_cost, "estimated_days_remaining": w.estimated_days_remaining, "last_topup": w.last_topup, "next_bill_estimate": w.next_bill_estimate} for w in rows}
        finally:
            db.close()

    def update_wallet(self, meter_id: str, data: dict):
        db = self._db()
        try:
            w = db.query(EnergyWallet).filter(EnergyWallet.meter_id == meter_id).first()
            if w:
                for k, v in data.items():
                    setattr(w, k, v)
                db.commit()
        finally:
            db.close()

    # ── STATIC DATA ────────────────────────────────────
    subscription_plans = [
        {"plan_name": "Free Plan", "description": "Core meter monitoring and billing views", "price_monthly": 0},
        {"plan_name": "Pro Energy Insights", "description": "Advanced analytics, usage alerts, AI insights", "price_monthly": 99},
        {"plan_name": "Smart Automation Plus", "description": "Automation bundles and optimization workflows", "price_monthly": 199},
    ]

    help_faqs = [
        {"id": 1, "question": "How do I read smart meter usage?", "answer": "Live load shows current kWh/h usage from active appliances and meter telemetry."},
        {"id": 2, "question": "How do I report a meter issue?", "answer": "Use Service Requests to raise complaints and track status updates in timeline view."},
        {"id": 3, "question": "Can I pay electricity bills online?", "answer": "Yes, unpaid bills can be paid from the Billing or Payments pages in this demo."},
    ]

    chat_sessions: dict = {}
    chat_query_logs: list = []
    chat_agent_state: dict = {}
    consumption_records: dict = {}
    solar_generation: dict = {}
    contact_messages: dict = {}

store = PostgresStore()
