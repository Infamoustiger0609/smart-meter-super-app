from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
from itertools import count
from typing import Any
from zoneinfo import ZoneInfo

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
        current_month = now.strftime("%Y-%m")

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
        for h in range(24):
            units = round(max(0, 3.2 - abs(12 - h) * 0.35), 2)
            record_id = f"srec_{next(self._id_counters['solar_record'])}"
            ts = now.replace(hour=h, minute=0, second=0, microsecond=0)
            self.solar_generation[record_id] = {
                "record_id": record_id,
                "system_id": "solar_1",
                "timestamp": ts.isoformat(),
                "units_generated": units,
            }

        self.consumption_records: dict[str, dict[str, Any]] = {}
        for h in range(24 * 14):
            ts = now - timedelta(hours=h)
            hour = ts.hour
            base = 0.55 if 1 <= hour < 5 else 0.95
            peak_boost = 0.45 if 14 <= hour <= 22 else 0
            units = round(base + peak_boost + ((h % 5) * 0.05), 3)
            rec_id = f"cons_{next(self._id_counters['consumption'])}"
            self.consumption_records[rec_id] = {
                "record_id": rec_id,
                "meter_id": "meter_1",
                "timestamp": ts.isoformat(),
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


store = MemoryStore()
