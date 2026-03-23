from __future__ import annotations

from datetime import datetime, timedelta
import json
import random
from zoneinfo import ZoneInfo

from backend.auth.security import hash_password
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


def _ensure_user_with_meter(
    db,
    *,
    email: str,
    fallback_user_id: str,
    full_name: str,
    password: str,
    role: str,
    fallback_meter_id: str,
    location: str,
    now: datetime,
) -> tuple[str, str]:
    user = db.query(User).filter(User.email == email.lower()).first()

    if user is None:
        meter = db.query(Meter).filter(Meter.meter_id == fallback_meter_id).first()
        if meter is None:
            meter = Meter(
                meter_id=fallback_meter_id,
                smart_meter_id=f"SM-CORE-{fallback_meter_id[-1]}",
                user_id=None,
                location=location,
                status="ACTIVE",
            )
            db.add(meter)
            db.flush()

        user = User(
            user_id=fallback_user_id,
            full_name=full_name,
            email=email.lower(),
            password_hash=hash_password(password),
            role=role,
            smart_meter_id=meter.meter_id,
            created_at=(now - timedelta(days=180)).isoformat(),
        )
        db.add(user)
        db.flush()
        meter.user_id = user.user_id

    meter_id = user.smart_meter_id
    if not meter_id:
        meter_id = fallback_meter_id
        meter = db.query(Meter).filter(Meter.meter_id == meter_id).first()
        if meter is None:
            meter = Meter(
                meter_id=meter_id,
                smart_meter_id=f"SM-CORE-{meter_id[-1]}",
                user_id=user.user_id,
                location=location,
                status="ACTIVE",
            )
            db.add(meter)
            db.flush()
        user.smart_meter_id = meter_id
        if meter.user_id is None:
            meter.user_id = user.user_id

    return user.user_id, meter_id


def seed_development_data() -> None:
    """Postgres-safe rich demo seeding + runtime chart cache population."""
    rng = random.Random(2026)
    now = datetime.now(IST)

    db = SessionLocal()
    try:
        consumer_ids: list[str] = []
        meter_ids_by_user: dict[str, str] = {}
        base_monthly_units: dict[str, float] = {}

        # Ensure login accounts exist (or reuse existing accounts by email).
        user_demo_id, user_demo_meter = _ensure_user_with_meter(
            db,
            email="user@demo.com",
            fallback_user_id="user_demo",
            full_name="Demo Consumer",
            password="demo123",
            role="USER",
            fallback_meter_id="meter_core_1",
            location="Noida Sector 62",
            now=now,
        )
        _ensure_user_with_meter(
            db,
            email="admin@demo.com",
            fallback_user_id="admin_core",
            full_name="Admin Operator",
            password="admin123",
            role="ADMIN",
            fallback_meter_id="meter_core_2",
            location="NCR Grid Zone",
            now=now,
        )
        _ensure_user_with_meter(
            db,
            email="operator@demo.com",
            fallback_user_id="operator_core",
            full_name="Utility Operator",
            password="operator123",
            role="UTILITY_OPERATOR",
            fallback_meter_id="meter_core_3",
            location="NCR Grid Zone",
            now=now,
        )

        # Wallet for demo consumer meter.
        wallet = db.query(EnergyWallet).filter(EnergyWallet.meter_id == user_demo_meter).first()
        if wallet is None:
            db.add(
                EnergyWallet(
                    meter_id=user_demo_meter,
                    meter_type="PREPAID",
                    current_balance=920.0,
                    estimated_daily_cost=0.0,
                    estimated_days_remaining=0.0,
                    last_topup=(now - timedelta(days=6)).isoformat(),
                    next_bill_estimate=0.0,
                )
            )

        consumer_ids.append(user_demo_id)
        meter_ids_by_user[user_demo_id] = user_demo_meter
        base_monthly_units[user_demo_id] = 325.0

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

        # 42 additional consumers + meters.
        for i in range(1, 43):
            email = f"consumer{i:03d}@demo.com"
            desired_meter_id = f"meter_{i+1:03d}"
            meter = db.query(Meter).filter(Meter.meter_id == desired_meter_id).first()
            if meter is None:
                meter = Meter(
                    meter_id=desired_meter_id,
                    smart_meter_id=f"SM-{25000 + i}",
                    user_id=None,
                    location=rng.choice(locations),
                    status="ACTIVE" if rng.random() > 0.06 else "MAINTENANCE",
                )
                db.add(meter)
                db.flush()

            user = db.query(User).filter(User.email == email).first()

            if user is None:
                user = User(
                    user_id=f"user_{i:03d}",
                    full_name=f"{rng.choice(first_names)} {rng.choice(last_names)}",
                    email=email,
                    password_hash=hash_password("demo123"),
                    role="USER",
                    smart_meter_id=desired_meter_id,
                    created_at=(now - timedelta(days=rng.randint(45, 780))).isoformat(),
                )
                db.add(user)
                db.flush()

            meter_id = user.smart_meter_id or desired_meter_id
            meter = db.query(Meter).filter(Meter.meter_id == meter_id).first()
            if meter and meter.user_id is None:
                meter.user_id = user.user_id

            if user.smart_meter_id != meter_id:
                user.smart_meter_id = meter_id

            wallet = db.query(EnergyWallet).filter(EnergyWallet.meter_id == meter_id).first()
            if wallet is None:
                meter_type = "PREPAID" if rng.random() < 0.62 else "POSTPAID"
                db.add(
                    EnergyWallet(
                        meter_id=meter_id,
                        meter_type=meter_type,
                        current_balance=round(rng.uniform(220, 2200), 2) if meter_type == "PREPAID" else 0.0,
                        estimated_daily_cost=0.0,
                        estimated_days_remaining=0.0,
                        last_topup=(now - timedelta(days=rng.randint(1, 26))).isoformat() if meter_type == "PREPAID" else None,
                        next_bill_estimate=0.0,
                    )
                )

            consumer_ids.append(user.user_id)
            meter_ids_by_user[user.user_id] = meter_id
            base_monthly_units[user.user_id] = round(rng.uniform(120, 750), 2)

        # Add extra utility meters so dashboard scale matches old demo (~45 meters).
        for idx in (44, 45):
            meter_id = f"meter_{idx:03d}"
            meter = db.query(Meter).filter(Meter.meter_id == meter_id).first()
            if meter is None:
                meter = Meter(
                    meter_id=meter_id,
                    smart_meter_id=f"SM-{28000 + idx}",
                    user_id=None,
                    location=rng.choice(locations),
                    status="ACTIVE",
                )
                db.add(meter)
                db.flush()
            if db.query(EnergyWallet).filter(EnergyWallet.meter_id == meter_id).first() is None:
                db.add(
                    EnergyWallet(
                        meter_id=meter_id,
                        meter_type="POSTPAID",
                        current_balance=0.0,
                        estimated_daily_cost=0.0,
                        estimated_days_remaining=0.0,
                        last_topup=None,
                        next_bill_estimate=0.0,
                    )
                )

        db.flush()

        existing_bill_ids = {row[0] for row in db.query(Bill.bill_id).all()}
        existing_payment_ids = {row[0] for row in db.query(Payment.payment_id).all()}
        existing_request_ids = {row[0] for row in db.query(ServiceRequest.request_id).all()}
        existing_subscription_ids = {row[0] for row in db.query(Subscription.subscription_id).all()}
        existing_solar_ids = {row[0] for row in db.query(SolarSystem.system_id).all()}

        billing_months = [_month_string(now, -m) for m in range(0, 6)]
        payment_methods = ["UPI", "NET_BANKING", "CARD"]

        bill_counter = 1
        pay_counter = 1
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
                status = "UNPAID" if (month_str == billing_months[0] and rng.random() < 0.7) else "PAID"

                bill_id = f"demo_bill_{bill_counter:05d}"
                bill_counter += 1
                if bill_id not in existing_bill_ids:
                    db.add(
                        Bill(
                            bill_id=bill_id,
                            user_id=user_id,
                            meter_id=meter_id,
                            billing_month=month_str,
                            units_consumed=units,
                            amount=amount,
                            due_date=due_date,
                            status=status,
                            pdf_url=f"/mock/bills/{bill_id}.pdf",
                        )
                    )
                    existing_bill_ids.add(bill_id)

                if status == "PAID" or rng.random() < 0.35:
                    payment_id = f"demo_pay_{pay_counter:05d}"
                    pay_counter += 1
                    if payment_id not in existing_payment_ids:
                        paid_at = now - timedelta(days=rng.randint(1, 170), hours=rng.randint(0, 23))
                        payment_status = "SUCCESS" if status == "PAID" else "FAILED"
                        attempted = amount if payment_status == "SUCCESS" else round(amount * rng.uniform(0.4, 1.0), 2)
                        db.add(
                            Payment(
                                payment_id=payment_id,
                                bill_id=bill_id,
                                user_id=user_id,
                                amount=attempted,
                                payment_method=rng.choice(payment_methods),
                                transaction_id=f"TXN-{paid_at.strftime('%Y%m%d')}-{rng.randint(100000, 999999)}",
                                payment_status=payment_status,
                                payment_date=paid_at.isoformat(),
                            )
                        )
                        existing_payment_ids.add(payment_id)

        request_types = [
            "meter malfunction",
            "billing dispute",
            "outage report",
            "installation request",
            "voltage fluctuation",
        ]
        statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]

        for i in range(1, 65):
            req_id = f"demo_req_{i:04d}"
            if req_id in existing_request_ids:
                continue
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

            db.add(
                ServiceRequest(
                    request_id=req_id,
                    user_id=user_id,
                    meter_id=meter_id,
                    request_type=rng.choice(request_types),
                    description="Auto-seeded request for demo and UI workflow testing.",
                    status=status,
                    created_at=created.isoformat(),
                    updated_at=updated.isoformat(),
                    timeline=json.dumps(timeline),
                )
            )
            existing_request_ids.add(req_id)

        plan_names = [p["plan_name"] for p in store.subscription_plans]
        for i, user_id in enumerate(consumer_ids, start=1):
            sub_id = f"demo_sub_{i:04d}"
            if sub_id in existing_subscription_ids:
                continue
            start = now.date() - timedelta(days=rng.randint(5, 120))
            status = "ACTIVE" if rng.random() < 0.84 else "INACTIVE"
            db.add(
                Subscription(
                    subscription_id=sub_id,
                    user_id=user_id,
                    plan_name=rng.choice(plan_names),
                    start_date=start.isoformat(),
                    end_date=(start + timedelta(days=30)).isoformat() if status == "INACTIVE" else None,
                    status=status,
                )
            )
            existing_subscription_ids.add(sub_id)

        solar_users = rng.sample(consumer_ids, k=max(20, int(len(consumer_ids) * 0.45)))
        for i, user_id in enumerate(solar_users, start=1):
            system_id = f"demo_solar_{i:03d}"
            if system_id in existing_solar_ids:
                continue
            db.add(
                SolarSystem(
                    system_id=system_id,
                    user_id=user_id,
                    capacity_kw=round(rng.uniform(2.2, 8.0), 2),
                    installation_date=(now.date() - timedelta(days=rng.randint(120, 1600))).isoformat(),
                    location=rng.choice(locations),
                )
            )
            existing_solar_ids.add(system_id)

        db.commit()

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    # In-memory runtime caches used by analytics charts.
    store.consumption_records.clear()
    rec_counter = 1
    appliance_ids = [
        "plug_1", "plug_2", "plug_3", "plug_4", "plug_5", "plug_6", "plug_7", "plug_8", "plug_9",
        "plug_10", "plug_11", "plug_12", "plug_13", "plug_14",
    ]
    meter_ids = sorted(store.meters.keys())[:45]
    for meter_id in meter_ids:
        baseline = random.Random(f"{meter_id}-base").uniform(0.22, 0.95)
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
            rec_id = f"cons_{rec_counter:06d}"
            rec_counter += 1
            store.consumption_records[rec_id] = {
                "record_id": rec_id,
                "meter_id": meter_id,
                "timestamp": ts.isoformat(),
                "units": units,
                "appliance_id": rng.choice(appliance_ids) if rng.random() < 0.35 else None,
            }

    store.solar_generation.clear()
    s_counter = 1
    for system in store.solar_systems.values():
        capacity = float(system.get("capacity_kw") or 0.0)
        for day_offset in range(0, 7):
            base_day = (now - timedelta(days=day_offset)).replace(minute=0, second=0, microsecond=0)
            for hour in range(24):
                ts = base_day.replace(hour=hour)
                solar_shape = max(0, 1 - (abs(12 - hour) / 6))
                weather_noise = rng.uniform(0.72, 1.12)
                generated = round(capacity * solar_shape * weather_noise * 0.38, 3)
                rec_id = f"srec_{s_counter:06d}"
                s_counter += 1
                store.solar_generation[rec_id] = {
                    "record_id": rec_id,
                    "system_id": system["system_id"],
                    "timestamp": ts.isoformat(),
                    "units_generated": max(0.0, generated),
                }

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
