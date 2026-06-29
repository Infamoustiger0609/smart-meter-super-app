from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
from itertools import count
from typing import Any
from zoneinfo import ZoneInfo
import json

IST = ZoneInfo("Asia/Kolkata")


class MemoryStore:
    def __init__(self) -> None:
        self._id_counters = {
            "user": count(2),
            "meter": count(2),
            "bill": count(3),
            "payment": count(2),
            "request": count(2),
            "subscription": count(2),
            "solar_system": count(2),
            "solar_record": count(2),
            "consumption": count(2),
            "contact": count(2),
        }

        now = datetime.now(IST)

        self.users: dict[str, dict[str, Any]] = {
            "usr_1": {
                "user_id": "usr_1",
                "full_name": "Demo User",
                "email": "user@demo.com",
                "password_hash": "",
                "role": "USER",
                "smart_meter_id": "meter_1",
                "created_at": now.isoformat(),
            },
            "adm_1": {
                "user_id": "adm_1",
                "full_name": "Admin Operator",
                "email": "admin@demo.com",
                "password_hash": "",
                "role": "ADMIN",
                "smart_meter_id": "meter_1",
                "created_at": now.isoformat(),
            },
            "util_1": {
                "user_id": "util_1",
                "full_name": "Utility Operator",
                "email": "operator@demo.com",
                "password_hash": "",
                "role": "UTILITY_OPERATOR",
                "smart_meter_id": "meter_1",
                "created_at": now.isoformat(),
            },
        }

        self.meters: dict[str, dict[str, Any]] = {
            "meter_1": {
                "meter_id": "meter_1",
                "smart_meter_id": "SM-10001",
                "user_id": "usr_1",
                "location": "Noida Sector 62",
                "status": "ACTIVE",
            }
        }

        self.bills: dict[str, dict[str, Any]] = {
            "bill_1": {
                "bill_id": "bill_1",
                "user_id": "usr_1",
                "meter_id": "meter_1",
                "billing_month": (now - timedelta(days=60)).strftime("%Y-%m"),
                "units_consumed": 312.4,
                "amount": 1718.2,
                "due_date": (now - timedelta(days=20)).date().isoformat(),
                "status": "PAID",
                "pdf_url": "/mock/bills/bill_1.pdf",
            },
            "bill_2": {
                "bill_id": "bill_2",
                "user_id": "usr_1",
                "meter_id": "meter_1",
                "billing_month": (now - timedelta(days=30)).strftime("%Y-%m"),
                "units_consumed": 287.0,
                "amount": 1594.8,
                "due_date": (now + timedelta(days=8)).date().isoformat(),
                "status": "UNPAID",
                "pdf_url": "/mock/bills/bill_2.pdf",
            },
        }

        self.payments: dict[str, dict[str, Any]] = {
            "pay_1": {
                "payment_id": "pay_1",
                "bill_id": "bill_1",
                "user_id": "usr_1",
                "amount": 1718.2,
                "payment_method": "UPI",
                "transaction_id": "TXN-DEMO-1001",
                "payment_status": "SUCCESS",
                "payment_date": (now - timedelta(days=15)).isoformat(),
            }
        }

        self.service_requests: dict[str, dict[str, Any]] = {
            "req_1": {
                "request_id": "req_1",
                "user_id": "usr_1",
                "meter_id": "meter_1",
                "request_type": "meter malfunction",
                "description": "Meter display intermittently turns blank.",
                "status": "IN_PROGRESS",
                "created_at": (now - timedelta(days=3)).isoformat(),
                "updated_at": (now - timedelta(days=1)).isoformat(),
                "timeline": [
                    {
                        "status": "OPEN",
                        "note": "Request raised",
                        "at": (now - timedelta(days=3)).isoformat(),
                    },
                    {
                        "status": "IN_PROGRESS",
                        "note": "Assigned to field team",
                        "at": (now - timedelta(days=1)).isoformat(),
                    },
                ],
            }
        }

        self.subscription_plans = [
            {
                "plan_name": "Free Plan",
                "description": "Core meter monitoring and billing views",
                "price_monthly": 0,
            },
            {
                "plan_name": "Pro Energy Insights",
                "description": "Advanced analytics, usage alerts, AI insights",
                "price_monthly": 99,
            },
            {
                "plan_name": "Smart Automation Plus",
                "description": "Automation bundles and optimization workflows",
                "price_monthly": 199,
            },
        ]

        self.subscriptions: dict[str, dict[str, Any]] = {
            "sub_1": {
                "subscription_id": "sub_1",
                "user_id": "usr_1",
                "plan_name": "Free Plan",
                "start_date": now.date().isoformat(),
                "end_date": None,
                "status": "ACTIVE",
            }
        }

        self.solar_systems: dict[str, dict[str, Any]] = {
            "solar_1": {
                "system_id": "solar_1",
                "user_id": "usr_1",
                "capacity_kw": 4.5,
                "installation_date": (now - timedelta(days=300)).date().isoformat(),
                "location": "Rooftop - Block A",
            }
        }

        self.solar_generation: dict[str, dict[str, Any]] = {}
        for hour in range(24):
            units = round(max(0, 3.2 - abs(12 - hour) * 0.35), 2)
            record_id = f"srec_{next(self._id_counters['solar_record'])}"
            timestamp = now.replace(hour=hour, minute=0, second=0, microsecond=0)
            self.solar_generation[record_id] = {
                "record_id": record_id,
                "system_id": "solar_1",
                "timestamp": timestamp.isoformat(),
                "units_generated": units,
            }

        self.consumption_records: dict[str, dict[str, Any]] = {}
        for hour in range(24 * 14):
            timestamp = now - timedelta(hours=hour)
            base = 0.55 if 1 <= timestamp.hour < 5 else 0.95
            peak_boost = 0.45 if 14 <= timestamp.hour <= 22 else 0
            units = round(base + peak_boost + ((hour % 5) * 0.05), 3)
            record_id = f"cons_{next(self._id_counters['consumption'])}"
            self.consumption_records[record_id] = {
                "record_id": record_id,
                "meter_id": "meter_1",
                "timestamp": timestamp.isoformat(),
                "units": units,
                "appliance_id": None,
            }

        self.help_faqs = [
            {
                "id": 1,
                "question": "How do I read smart meter usage?",
                "answer": "Live load shows current kWh/h usage from active appliances and meter telemetry.",
            },
            {
                "id": 2,
                "question": "How do I report a meter issue?",
                "answer": "Use Service Requests to raise complaints and track status updates in timeline view.",
            },
            {
                "id": 3,
                "question": "Can I pay electricity bills online?",
                "answer": "Yes, unpaid bills can be paid from the Billing or Payments pages in this demo.",
            },
        ]

        self.contact_messages: dict[str, dict[str, Any]] = {}
        self.chat_sessions: dict[str, list[dict[str, Any]]] = {}
        self.chat_query_logs: list[dict[str, Any]] = []
        self.chat_agent_state: dict[str, dict[str, Any]] = {}
        self.energy_wallets: dict[str, dict[str, Any]] = {
            "meter_1": {
                "meter_id": "meter_1",
                "meter_type": "PREPAID",
                "current_balance": 780.0,
                "estimated_daily_cost": 0.0,
                "estimated_days_remaining": 0.0,
                "last_topup": (now - timedelta(days=8)).isoformat(),
                "next_bill_estimate": 0.0,
            }
        }

    def next_id(self, prefix: str) -> str:
        return f"{prefix}_{next(self._id_counters[prefix])}"

    def clone_user_safe(self, user: dict[str, Any]) -> dict[str, Any]:
        cloned = deepcopy(user)
        cloned.pop("password_hash", None)
        return cloned


def _load_db_components():
    from backend.database.db import (
        Bill,
        EnergyWallet,
        Meter,
        Payment,
        ServiceRequest,
        SessionLocal,
        SolarSystem,
        Subscription,
        User,
    )

    return SessionLocal, User, Meter, Bill, Payment, ServiceRequest, Subscription, SolarSystem, EnergyWallet


class PostgresStore:
    def next_id(self, prefix: str) -> str:
        import random
        import time

        return f"{prefix}_{int(time.time())}_{random.randint(100, 999)}"

    def _db(self):
        SessionLocal, *_ = _load_db_components()
        return SessionLocal()

    def _user_to_dict(self, user):
        if not user:
            return None
        return {
            "user_id": user.user_id,
            "full_name": user.full_name,
            "email": user.email,
            "password_hash": user.password_hash,
            "role": user.role,
            "smart_meter_id": user.smart_meter_id,
            "created_at": user.created_at,
        }

    def _meter_to_dict(self, meter):
        if not meter:
            return None
        return {
            "meter_id": meter.meter_id,
            "smart_meter_id": meter.smart_meter_id,
            "user_id": meter.user_id,
            "location": meter.location,
            "status": meter.status,
        }

    def _bill_to_dict(self, bill):
        if not bill:
            return None
        return {
            "bill_id": bill.bill_id,
            "user_id": bill.user_id,
            "meter_id": bill.meter_id,
            "billing_month": bill.billing_month,
            "units_consumed": bill.units_consumed,
            "amount": bill.amount,
            "due_date": bill.due_date,
            "status": bill.status,
            "pdf_url": bill.pdf_url,
        }

    def _payment_to_dict(self, payment):
        if not payment:
            return None
        return {
            "payment_id": payment.payment_id,
            "bill_id": payment.bill_id,
            "user_id": payment.user_id,
            "amount": payment.amount,
            "payment_method": payment.payment_method,
            "transaction_id": payment.transaction_id,
            "payment_status": payment.payment_status,
            "payment_date": payment.payment_date,
        }

    def _req_to_dict(self, request):
        if not request:
            return None
        return {
            "request_id": request.request_id,
            "user_id": request.user_id,
            "meter_id": request.meter_id,
            "request_type": request.request_type,
            "description": request.description,
            "status": request.status,
            "created_at": request.created_at,
            "updated_at": request.updated_at,
            "timeline": json.loads(request.timeline or "[]"),
        }

    def _sub_to_dict(self, subscription):
        if not subscription:
            return None
        return {
            "subscription_id": subscription.subscription_id,
            "user_id": subscription.user_id,
            "plan_name": subscription.plan_name,
            "start_date": subscription.start_date,
            "end_date": subscription.end_date,
            "status": subscription.status,
        }

    @property
    def users(self):
        _, User, *_ = _load_db_components()
        db = self._db()
        try:
            rows = db.query(User).all()
            return {user.user_id: self._user_to_dict(user) for user in rows}
        finally:
            db.close()

    def get_user_by_email(self, email: str):
        _, User, *_ = _load_db_components()
        db = self._db()
        try:
            user = db.query(User).filter(User.email == email.lower()).first()
            return self._user_to_dict(user) if user else None
        finally:
            db.close()

    def get_user(self, user_id: str):
        _, User, *_ = _load_db_components()
        db = self._db()
        try:
            user = db.query(User).filter(User.user_id == user_id).first()
            return self._user_to_dict(user) if user else None
        finally:
            db.close()

    def add_user(self, user: dict):
        _, User, *_ = _load_db_components()
        db = self._db()
        try:
            row = User(
                **{key: value for key, value in user.items() if key != "password_hash"},
                password_hash=user.get("password_hash", ""),
            )
            db.add(row)
            db.commit()
        finally:
            db.close()

    def clone_user_safe(self, user: dict) -> dict:
        cloned = dict(user)
        cloned.pop("password_hash", None)
        return cloned

    @property
    def meters(self):
        _, _, Meter, *_ = _load_db_components()
        db = self._db()
        try:
            rows = db.query(Meter).all()
            return {meter.meter_id: self._meter_to_dict(meter) for meter in rows}
        finally:
            db.close()

    def get_meter(self, meter_id: str):
        _, _, Meter, *_ = _load_db_components()
        db = self._db()
        try:
            meter = db.query(Meter).filter(Meter.meter_id == meter_id).first()
            return self._meter_to_dict(meter) if meter else None
        finally:
            db.close()

    def add_meter(self, meter: dict):
        _, _, Meter, *_ = _load_db_components()
        db = self._db()
        try:
            row = Meter(**meter)
            db.add(row)
            db.commit()
        finally:
            db.close()

    @property
    def bills(self):
        _, _, _, Bill, *_ = _load_db_components()
        db = self._db()
        try:
            rows = db.query(Bill).all()
            return {bill.bill_id: self._bill_to_dict(bill) for bill in rows}
        finally:
            db.close()

    def get_bill(self, bill_id: str):
        _, _, _, Bill, *_ = _load_db_components()
        db = self._db()
        try:
            bill = db.query(Bill).filter(Bill.bill_id == bill_id).first()
            return self._bill_to_dict(bill) if bill else None
        finally:
            db.close()

    def add_bill(self, bill: dict):
        _, _, _, Bill, *_ = _load_db_components()
        db = self._db()
        try:
            row = Bill(**bill)
            db.add(row)
            db.commit()
        finally:
            db.close()

    def update_bill_status(self, bill_id: str, status: str):
        _, _, _, Bill, *_ = _load_db_components()
        db = self._db()
        try:
            bill = db.query(Bill).filter(Bill.bill_id == bill_id).first()
            if bill:
                bill.status = status
                db.commit()
        finally:
            db.close()

    @property
    def payments(self):
        _, _, _, _, Payment, *_ = _load_db_components()
        db = self._db()
        try:
            rows = db.query(Payment).all()
            return {payment.payment_id: self._payment_to_dict(payment) for payment in rows}
        finally:
            db.close()

    def add_payment(self, payment: dict):
        _, _, _, _, Payment, *_ = _load_db_components()
        db = self._db()
        try:
            row = Payment(**payment)
            db.add(row)
            db.commit()
        finally:
            db.close()

    @property
    def service_requests(self):
        _, _, _, _, _, ServiceRequest, *_ = _load_db_components()
        db = self._db()
        try:
            rows = db.query(ServiceRequest).all()
            return {request.request_id: self._req_to_dict(request) for request in rows}
        finally:
            db.close()

    def get_service_request(self, request_id: str):
        _, _, _, _, _, ServiceRequest, *_ = _load_db_components()
        db = self._db()
        try:
            request = db.query(ServiceRequest).filter(ServiceRequest.request_id == request_id).first()
            return self._req_to_dict(request) if request else None
        finally:
            db.close()

    def add_service_request(self, request: dict):
        _, _, _, _, _, ServiceRequest, *_ = _load_db_components()
        db = self._db()
        try:
            row = ServiceRequest(**{**request, "timeline": json.dumps(request.get("timeline", []))})
            db.add(row)
            db.commit()
        finally:
            db.close()

    def update_service_request(self, request_id: str, status: str, timeline: list):
        _, _, _, _, _, ServiceRequest, *_ = _load_db_components()
        db = self._db()
        try:
            request = db.query(ServiceRequest).filter(ServiceRequest.request_id == request_id).first()
            if request:
                request.status = status
                request.timeline = json.dumps(timeline)
                request.updated_at = datetime.now(IST).isoformat()
                db.commit()
        finally:
            db.close()

    @property
    def subscriptions(self):
        _, _, _, _, _, _, Subscription, *_ = _load_db_components()
        db = self._db()
        try:
            rows = db.query(Subscription).all()
            return {
                subscription.subscription_id: self._sub_to_dict(subscription)
                for subscription in rows
            }
        finally:
            db.close()

    def get_subscription(self, user_id: str):
        _, _, _, _, _, _, Subscription, *_ = _load_db_components()
        db = self._db()
        try:
            subscription = (
                db.query(Subscription)
                .filter(Subscription.user_id == user_id, Subscription.status == "ACTIVE")
                .first()
            )
            return self._sub_to_dict(subscription) if subscription else None
        finally:
            db.close()

    def update_subscription(self, user_id: str, plan_name: str):
        _, _, _, _, _, _, Subscription, *_ = _load_db_components()
        db = self._db()
        try:
            subscription = db.query(Subscription).filter(Subscription.user_id == user_id).first()
            if subscription:
                subscription.plan_name = plan_name
                db.commit()
        finally:
            db.close()

    @property
    def solar_systems(self):
        _, _, _, _, _, _, _, SolarSystem, _ = _load_db_components()
        db = self._db()
        try:
            rows = db.query(SolarSystem).all()
            return {
                system.system_id: {
                    "system_id": system.system_id,
                    "user_id": system.user_id,
                    "capacity_kw": system.capacity_kw,
                    "installation_date": system.installation_date,
                    "location": system.location,
                }
                for system in rows
            }
        finally:
            db.close()

    @property
    def energy_wallets(self):
        _, _, _, _, _, _, _, _, EnergyWallet = _load_db_components()
        db = self._db()
        try:
            rows = db.query(EnergyWallet).all()
            return {
                wallet.meter_id: {
                    "meter_id": wallet.meter_id,
                    "meter_type": wallet.meter_type,
                    "current_balance": wallet.current_balance,
                    "estimated_daily_cost": wallet.estimated_daily_cost,
                    "estimated_days_remaining": wallet.estimated_days_remaining,
                    "last_topup": wallet.last_topup,
                    "next_bill_estimate": wallet.next_bill_estimate,
                }
                for wallet in rows
            }
        finally:
            db.close()

    def update_wallet(self, meter_id: str, data: dict):
        _, _, _, _, _, _, _, _, EnergyWallet = _load_db_components()
        db = self._db()
        try:
            wallet = db.query(EnergyWallet).filter(EnergyWallet.meter_id == meter_id).first()
            if wallet:
                for key, value in data.items():
                    setattr(wallet, key, value)
                db.commit()
        finally:
            db.close()

    subscription_plans = [
        {
            "plan_name": "Free Plan",
            "description": "Core meter monitoring and billing views",
            "price_monthly": 0,
        },
        {
            "plan_name": "Pro Energy Insights",
            "description": "Advanced analytics, usage alerts, AI insights",
            "price_monthly": 99,
        },
        {
            "plan_name": "Smart Automation Plus",
            "description": "Automation bundles and optimization workflows",
            "price_monthly": 199,
        },
    ]

    help_faqs = [
        {
            "id": 1,
            "question": "How do I read smart meter usage?",
            "answer": "Live load shows current kWh/h usage from active appliances and meter telemetry.",
        },
        {
            "id": 2,
            "question": "How do I report a meter issue?",
            "answer": "Use Service Requests to raise complaints and track status updates in timeline view.",
        },
        {
            "id": 3,
            "question": "Can I pay electricity bills online?",
            "answer": "Yes, unpaid bills can be paid from the Billing or Payments pages in this demo.",
        },
    ]

    chat_sessions: dict = {}
    chat_query_logs: list = []
    chat_agent_state: dict = {}
    consumption_records: dict = {}
    solar_generation: dict = {}
    contact_messages: dict = {}


store = MemoryStore()
