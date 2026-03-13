from __future__ import annotations

from datetime import datetime, timedelta
from itertools import count
import random
from typing import Any
from zoneinfo import ZoneInfo

from backend.auth.security import hash_password
from backend.database.memory_store import store

IST = ZoneInfo("Asia/Kolkata")


def _month_string(base: datetime, offset: int) -> str:
    dt = (base.replace(day=15) + timedelta(days=offset * 31)).replace(day=1)
    return dt.strftime("%Y-%m")


def _season_multiplier(month: int) -> float:
    if month in {4, 5, 6}:
        return 1.22
    if month in {11, 12, 1}:
        return 0.92
    return 1.0


def seed_development_data() -> None:
    rng = random.Random(2026)
    now = datetime.now(IST)

    store._id_counters = {
        "user": count(501),
        "meter": count(501),
        "bill": count(501),
        "payment": count(501),
        "request": count(501),
        "subscription": count(501),
        "solar_system": count(501),
        "solar_record": count(501),
        "consumption": count(501),
        "contact": count(501),
    }

    store.users = {}
    store.meters = {}
    store.bills = {}
    store.payments = {}
    store.service_requests = {}
    store.subscriptions = {}
    store.solar_systems = {}
    store.solar_generation = {}
    store.consumption_records = {}
    store.contact_messages = {}
    store.chat_sessions = {}
    store.chat_query_logs = []
    store.chat_agent_state = {}
    store.energy_wallets = {}

    consumer_ids: list[str] = []
    meter_ids_by_user: dict[str, str] = {}
    base_monthly_units: dict[str, float] = {}

    # Core demo identities for quick login and role-based access testing.
    demo_users = [
        {
            "user_id": "user_demo",
            "full_name": "Demo Consumer",
            "email": "user@demo.com",
            "password": "demo123",
            "role": "USER",
        },
        {
            "user_id": "admin_core",
            "full_name": "Admin Operator",
            "email": "admin@demo.com",
            "password": "admin123",
            "role": "ADMIN",
        },
        {
            "user_id": "operator_core",
            "full_name": "Utility Operator",
            "email": "operator@demo.com",
            "password": "operator123",
            "role": "UTILITY_OPERATOR",
        },
    ]

    for index, user in enumerate(demo_users, start=1):
        meter_id = f"meter_core_{index}"
        store.meters[meter_id] = {
            "meter_id": meter_id,
            "smart_meter_id": f"SM-CORE-{1000 + index}",
            "user_id": user["user_id"],
            "location": "Noida" if index == 1 else "NCR Grid Zone",
            "status": "ACTIVE",
        }

        store.users[user["user_id"]] = {
            "user_id": user["user_id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "password_hash": hash_password(user["password"]),
            "role": user["role"],
            "smart_meter_id": meter_id,
            "created_at": (now - timedelta(days=240 - index * 7)).isoformat(),
        }
        store.energy_wallets[meter_id] = {
            "meter_id": meter_id,
            "meter_type": "PREPAID" if user["role"] == "USER" else "POSTPAID",
            "current_balance": 920.0 if user["role"] == "USER" else 0.0,
            "estimated_daily_cost": 0.0,
            "estimated_days_remaining": 0.0,
            "last_topup": (now - timedelta(days=6)).isoformat() if user["role"] == "USER" else None,
            "next_bill_estimate": 0.0,
        }

    consumer_ids.append("user_demo")
    meter_ids_by_user["user_demo"] = "meter_core_1"
    base_monthly_units["user_demo"] = 325.0

    first_names = [
        "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Ishaan", "Kabir", "Krishna", "Riya", "Anaya",
        "Aisha", "Diya", "Siya", "Meera", "Sara", "Neha", "Kiran", "Nisha", "Rahul", "Saanvi",
    ]
    last_names = [
        "Sharma", "Verma", "Singh", "Patel", "Gupta", "Rao", "Nair", "Iyer", "Khan", "Mishra",
    ]
    locations = [
        "Delhi", "Noida", "Gurugram", "Lucknow", "Jaipur", "Pune", "Bhopal", "Indore", "Mumbai", "Nagpur",
    ]

    # Create 42 additional consumer accounts for realistic admin-scale tables.
    for i in range(1, 43):
        user_id = f"user_{i:03d}"
        name = f"{rng.choice(first_names)} {rng.choice(last_names)}"
        email = f"consumer{i:03d}@demo.com"
        meter_id = f"meter_{i:03d}"

        store.users[user_id] = {
            "user_id": user_id,
            "full_name": name,
            "email": email,
            "password_hash": hash_password("demo123"),
            "role": "USER",
            "smart_meter_id": meter_id,
            "created_at": (now - timedelta(days=rng.randint(45, 780))).isoformat(),
        }
        store.meters[meter_id] = {
            "meter_id": meter_id,
            "smart_meter_id": f"SM-{25000 + i}",
            "user_id": user_id,
            "location": rng.choice(locations),
            "status": "ACTIVE" if rng.random() > 0.06 else "MAINTENANCE",
        }
        meter_type = "PREPAID" if rng.random() < 0.62 else "POSTPAID"
        store.energy_wallets[meter_id] = {
            "meter_id": meter_id,
            "meter_type": meter_type,
            "current_balance": round(rng.uniform(220, 2200), 2) if meter_type == "PREPAID" else 0.0,
            "estimated_daily_cost": 0.0,
            "estimated_days_remaining": 0.0,
            "last_topup": (now - timedelta(days=rng.randint(1, 26))).isoformat() if meter_type == "PREPAID" else None,
            "next_bill_estimate": 0.0,
        }

        consumer_ids.append(user_id)
        meter_ids_by_user[user_id] = meter_id
        base_monthly_units[user_id] = round(rng.uniform(120, 750), 2)

    # Bills: 6 monthly cycles per consumer with realistic seasonal variation.
    billing_months = [_month_string(now, -m) for m in range(0, 6)]
    payment_methods = ["UPI", "NET_BANKING", "CARD"]

    for user_id in consumer_ids:
        meter_id = meter_ids_by_user[user_id]
        baseline = base_monthly_units[user_id]
        for month_str in billing_months:
            y, m = [int(x) for x in month_str.split("-")]
            month_factor = _season_multiplier(m)
            random_factor = rng.uniform(0.86, 1.18)
            units = round(baseline * month_factor * random_factor, 2)

            amount = round(units * rng.uniform(5.1, 7.4), 2)
            due_date = datetime(y, m, min(28, rng.randint(8, 20)), tzinfo=IST).date().isoformat()

            if month_str == billing_months[0]:
                status = "UNPAID" if rng.random() < 0.7 else "PAID"
            else:
                status = "PAID" if rng.random() < 0.84 else "UNPAID"

            bill_id = f"bill_{next(store._id_counters['bill'])}"
            store.bills[bill_id] = {
                "bill_id": bill_id,
                "user_id": user_id,
                "meter_id": meter_id,
                "billing_month": month_str,
                "units_consumed": units,
                "amount": amount,
                "due_date": due_date,
                "status": status,
                "pdf_url": f"/mock/bills/{bill_id}.pdf",
            }

            if status == "PAID":
                payment_id = f"pay_{next(store._id_counters['payment'])}"
                paid_at = now - timedelta(days=rng.randint(1, 170), hours=rng.randint(0, 23))
                store.payments[payment_id] = {
                    "payment_id": payment_id,
                    "bill_id": bill_id,
                    "user_id": user_id,
                    "amount": amount,
                    "payment_method": rng.choice(payment_methods),
                    "transaction_id": f"TXN-{paid_at.strftime('%Y%m%d')}-{rng.randint(100000, 999999)}",
                    "payment_status": "SUCCESS",
                    "payment_date": paid_at.isoformat(),
                }
            elif rng.random() < 0.35:
                # Failed attempt examples for unpaid bills.
                payment_id = f"pay_{next(store._id_counters['payment'])}"
                fail_at = now - timedelta(days=rng.randint(0, 40), hours=rng.randint(0, 23))
                attempted = round(amount * rng.uniform(0.4, 1.0), 2)
                store.payments[payment_id] = {
                    "payment_id": payment_id,
                    "bill_id": bill_id,
                    "user_id": user_id,
                    "amount": attempted,
                    "payment_method": rng.choice(payment_methods),
                    "transaction_id": f"TXN-{fail_at.strftime('%Y%m%d')}-F{rng.randint(1000, 9999)}",
                    "payment_status": "FAILED",
                    "payment_date": fail_at.isoformat(),
                }

    # Service requests: 64 requests across statuses and types.
    request_types = [
        "meter malfunction",
        "billing dispute",
        "outage report",
        "installation request",
        "voltage fluctuation",
    ]
    statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]

    for _ in range(64):
        user_id = rng.choice(consumer_ids)
        meter_id = meter_ids_by_user[user_id]
        created = now - timedelta(days=rng.randint(0, 130), hours=rng.randint(0, 23))
        status = rng.choices(statuses, weights=[0.25, 0.30, 0.30, 0.15], k=1)[0]

        timeline = [{"status": "OPEN", "note": "Request created", "at": created.isoformat()}]
        updated = created
        if status in {"IN_PROGRESS", "RESOLVED", "CLOSED"}:
            updated = created + timedelta(hours=rng.randint(4, 48))
            timeline.append({"status": "IN_PROGRESS", "note": "Assigned to operations team", "at": updated.isoformat()})
        if status in {"RESOLVED", "CLOSED"}:
            updated = updated + timedelta(hours=rng.randint(8, 72))
            timeline.append({"status": "RESOLVED", "note": "Issue resolved on field", "at": updated.isoformat()})
        if status == "CLOSED":
            updated = updated + timedelta(hours=rng.randint(4, 36))
            timeline.append({"status": "CLOSED", "note": "Ticket closed after user confirmation", "at": updated.isoformat()})

        req_id = f"req_{next(store._id_counters['request'])}"
        store.service_requests[req_id] = {
            "request_id": req_id,
            "user_id": user_id,
            "meter_id": meter_id,
            "request_type": rng.choice(request_types),
            "description": "Auto-seeded request for demo and UI workflow testing.",
            "status": status,
            "created_at": created.isoformat(),
            "updated_at": updated.isoformat(),
            "timeline": timeline,
        }

    # Ensure demo consumer always has visible service timeline entries.
    demo_meter = meter_ids_by_user["user_demo"]
    for idx, status in enumerate(["OPEN", "IN_PROGRESS", "RESOLVED"], start=1):
        created = now - timedelta(days=idx * 9)
        timeline = [{"status": "OPEN", "note": "Request created", "at": created.isoformat()}]
        updated = created
        if status in {"IN_PROGRESS", "RESOLVED"}:
            updated = updated + timedelta(hours=16)
            timeline.append({"status": "IN_PROGRESS", "note": "Assigned to local team", "at": updated.isoformat()})
        if status == "RESOLVED":
            updated = updated + timedelta(hours=22)
            timeline.append({"status": "RESOLVED", "note": "Issue fixed and verified", "at": updated.isoformat()})

        req_id = f"req_{next(store._id_counters['request'])}"
        store.service_requests[req_id] = {
            "request_id": req_id,
            "user_id": "user_demo",
            "meter_id": demo_meter,
            "request_type": request_types[idx % len(request_types)],
            "description": "Seeded demo ticket to showcase tracking workflow.",
            "status": status,
            "created_at": created.isoformat(),
            "updated_at": updated.isoformat(),
            "timeline": timeline,
        }

    # Subscriptions for all consumers.
    plan_weights = [0.45, 0.35, 0.20]
    plan_names = [p["plan_name"] for p in store.subscription_plans]
    for user_id in consumer_ids:
        sub_id = f"sub_{next(store._id_counters['subscription'])}"
        plan_name = rng.choices(plan_names, weights=plan_weights, k=1)[0]
        start = now.date() - timedelta(days=rng.randint(5, 120))
        status = "ACTIVE" if rng.random() < 0.84 else "INACTIVE"
        end_date = (start + timedelta(days=30)).isoformat() if status == "INACTIVE" else None
        store.subscriptions[sub_id] = {
            "subscription_id": sub_id,
            "user_id": user_id,
            "plan_name": plan_name,
            "start_date": start.isoformat(),
            "end_date": end_date,
            "status": status,
        }

    # Solar installations for ~45% of consumers.
    solar_users = rng.sample(consumer_ids, k=max(20, int(len(consumer_ids) * 0.45)))
    if "user_demo" not in solar_users:
        solar_users[0] = "user_demo"
    for user_id in solar_users:
        system_id = f"solar_{next(store._id_counters['solar_system'])}"
        capacity = round(rng.uniform(2.2, 8.0), 2)
        install_date = (now.date() - timedelta(days=rng.randint(120, 1600))).isoformat()
        store.solar_systems[system_id] = {
            "system_id": system_id,
            "user_id": user_id,
            "capacity_kw": capacity,
            "installation_date": install_date,
            "location": rng.choice(locations),
        }

        for day_offset in range(0, 7):
            base_day = (now - timedelta(days=day_offset)).replace(minute=0, second=0, microsecond=0)
            for hour in range(24):
                ts = base_day.replace(hour=hour)
                solar_shape = max(0, 1 - (abs(12 - hour) / 6))
                weather_noise = rng.uniform(0.72, 1.12)
                generated = round(capacity * solar_shape * weather_noise * 0.38, 3)
                rec_id = f"srec_{next(store._id_counters['solar_record'])}"
                store.solar_generation[rec_id] = {
                    "record_id": rec_id,
                    "system_id": system_id,
                    "timestamp": ts.isoformat(),
                    "units_generated": max(0.0, generated),
                }

    # Consumption logs: 30 days hourly for each user meter.
    appliance_ids = [
        "plug_1", "plug_2", "plug_3", "plug_4", "plug_5", "plug_6", "plug_7", "plug_8", "plug_9",
        "plug_10", "plug_11", "plug_12", "plug_13", "plug_14",
    ]

    for user_id in consumer_ids:
        meter_id = meter_ids_by_user[user_id]
        baseline = base_monthly_units[user_id] / (30 * 24)

        for hour_offset in range(0, 24 * 30):
            ts = now - timedelta(hours=hour_offset)
            hour = ts.hour
            seasonal = _season_multiplier(ts.month)

            if 18 <= hour <= 23:
                peak_boost = 1.48
            elif 6 <= hour <= 9:
                peak_boost = 1.22
            elif 1 <= hour <= 4:
                peak_boost = 0.68
            else:
                peak_boost = 1.0

            appliance_noise = rng.uniform(0.80, 1.24)
            units = round(max(0.05, baseline * seasonal * peak_boost * appliance_noise), 3)

            rec_id = f"cons_{next(store._id_counters['consumption'])}"
            store.consumption_records[rec_id] = {
                "record_id": rec_id,
                "meter_id": meter_id,
                "timestamp": ts.isoformat(),
                "units": units,
                "appliance_id": rng.choice(appliance_ids) if rng.random() < 0.35 else None,
            }

    # Preserve FAQ content and clear support contacts for fresh run.
    store.help_faqs = [
        {
            "id": 1,
            "question": "How is tariff determined in this app?",
            "answer": "Tariff is computed using IST time windows with off-peak rebates and peak surcharges.",
        },
        {
            "id": 2,
            "question": "Can I track service request progress?",
            "answer": "Yes, each request includes timeline events from OPEN through closure statuses.",
        },
        {
            "id": 3,
            "question": "Is solar net-metering visible?",
            "answer": "Solar users can see generation, grid import/export, and estimated savings in dashboard.",
        },
        {
            "id": 4,
            "question": "Which payment methods are supported in demo?",
            "answer": "UPI, NET_BANKING, and CARD flows are simulated for testing and demos.",
        },
    ]

    # Quick aggregate cache for admin visual summaries (optional support data).
    store.seed_summary = {
        "users": len(store.users),
        "meters": len(store.meters),
        "bills": len(store.bills),
        "payments": len(store.payments),
        "requests": len(store.service_requests),
        "subscriptions": len(store.subscriptions),
        "solar_systems": len(store.solar_systems),
        "solar_records": len(store.solar_generation),
        "consumption_records": len(store.consumption_records),
    }

