from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from backend.database.memory_store import store
from backend.tariff import get_tariff_for_time

IST = ZoneInfo("Asia/Kolkata")


def _safe_meter_id(user: dict[str, Any]) -> str:
    return user.get("smart_meter_id") or "meter_1"


def _build_default_wallet(meter_id: str) -> dict[str, Any]:
    return {
        "meter_id": meter_id,
        "meter_type": "PREPAID",
        "current_balance": 600.0,
        "estimated_daily_cost": 0.0,
        "estimated_days_remaining": 0.0,
        "last_topup": None,
        "next_bill_estimate": 0.0,
    }


def get_or_create_wallet_by_meter(meter_id: str) -> dict[str, Any]:
    wallet = store.energy_wallets.get(meter_id)
    if not wallet:
        wallet = _build_default_wallet(meter_id)
        store.energy_wallets[meter_id] = wallet
    return wallet


def get_or_create_wallet(user: dict[str, Any]) -> dict[str, Any]:
    return get_or_create_wallet_by_meter(_safe_meter_id(user))


def _cost_stats_for_meter(meter_id: str) -> dict[str, float]:
    now = datetime.now(IST)
    since = now - timedelta(days=7)

    total_cost = 0.0
    total_units = 0.0
    by_day: dict[str, float] = {}

    for rec in store.consumption_records.values():
        if rec.get("meter_id") != meter_id:
            continue

        ts = datetime.fromisoformat(rec["timestamp"]).astimezone(IST)
        if ts < since:
            continue

        units = float(rec.get("units", 0.0))
        tariff = float(get_tariff_for_time(ts))
        total_units += units
        total_cost += units * tariff
        day_key = ts.date().isoformat()
        by_day[day_key] = by_day.get(day_key, 0.0) + units * tariff

    days = max(1, len(by_day))
    avg_daily_cost = total_cost / days
    avg_daily_units = total_units / days
    avg_tariff = total_cost / total_units if total_units > 0 else float(get_tariff_for_time(now))

    return {
        "avg_daily_cost": round(avg_daily_cost, 2),
        "avg_daily_units": round(avg_daily_units, 3),
        "avg_tariff": round(avg_tariff, 2),
    }


def _next_unpaid_bill_amount(user_id: str) -> float:
    unpaid = [b for b in store.bills.values() if b.get("user_id") == user_id and b.get("status") == "UNPAID"]
    if not unpaid:
        return 0.0
    unpaid.sort(key=lambda x: x.get("billing_month", ""), reverse=True)
    return round(float(unpaid[0].get("amount", 0.0)), 2)


def recompute_wallet(user: dict[str, Any]) -> dict[str, Any]:
    meter_id = _safe_meter_id(user)
    wallet = get_or_create_wallet_by_meter(meter_id)
    stats = _cost_stats_for_meter(meter_id)
    now = datetime.now(IST)
    daily_cost = float(stats["avg_daily_cost"])
    meter_type = str(wallet.get("meter_type", "PREPAID")).upper()

    if meter_type == "PREPAID":
        days_left = round(float(wallet.get("current_balance", 0.0)) / daily_cost, 1) if daily_cost > 0 else 0.0
    else:
        outstanding = _next_unpaid_bill_amount(user["user_id"])
        days_left = round(outstanding / daily_cost, 1) if daily_cost > 0 and outstanding > 0 else 0.0

    projected_month_cost = round(stats["avg_daily_units"] * 30 * stats["avg_tariff"], 2)

    wallet["estimated_daily_cost"] = round(daily_cost, 2)
    wallet["estimated_days_remaining"] = max(0.0, days_left)
    wallet["next_bill_estimate"] = projected_month_cost
    wallet["predicted_zero_date"] = (
        (now + timedelta(days=wallet["estimated_days_remaining"])).date().isoformat()
        if wallet["estimated_days_remaining"] > 0
        else now.date().isoformat()
    )

    if meter_type == "POSTPAID":
        wallet["outstanding_amount"] = _next_unpaid_bill_amount(user["user_id"])
    else:
        wallet["outstanding_amount"] = 0.0

    wallet["avg_daily_units"] = stats["avg_daily_units"]
    wallet["avg_tariff"] = stats["avg_tariff"]
    return wallet


def get_balance_status(user: dict[str, Any]) -> dict[str, Any]:
    wallet = recompute_wallet(user)
    return {
        "meter_id": wallet["meter_id"],
        "meter_type": wallet.get("meter_type", "PREPAID"),
        "current_balance": round(float(wallet.get("current_balance", 0.0)), 2),
        "estimated_daily_cost": round(float(wallet.get("estimated_daily_cost", 0.0)), 2),
        "estimated_days_remaining": round(float(wallet.get("estimated_days_remaining", 0.0)), 1),
        "last_topup": wallet.get("last_topup"),
        "next_bill_estimate": round(float(wallet.get("next_bill_estimate", 0.0)), 2),
        "outstanding_amount": round(float(wallet.get("outstanding_amount", 0.0)), 2),
    }


def get_balance_forecast(user: dict[str, Any], recharge_amount: float | None = None) -> dict[str, Any]:
    wallet = recompute_wallet(user)
    daily_cost = float(wallet.get("estimated_daily_cost", 0.0))
    current_balance = float(wallet.get("current_balance", 0.0))
    amount = float(recharge_amount or 0.0)
    projected_balance = current_balance + max(0.0, amount)
    projected_days = round(projected_balance / daily_cost, 1) if daily_cost > 0 else 0.0
    recommended_recharge = max(0.0, round((daily_cost * 10) - current_balance, 2))

    return {
        "meter_id": wallet["meter_id"],
        "meter_type": wallet.get("meter_type", "PREPAID"),
        "current_balance": round(current_balance, 2),
        "estimated_daily_spending": round(daily_cost, 2),
        "estimated_days_remaining": round(float(wallet.get("estimated_days_remaining", 0.0)), 1),
        "predicted_zero_date": wallet.get("predicted_zero_date"),
        "recommended_recharge_amount": recommended_recharge,
        "avg_daily_units": round(float(wallet.get("avg_daily_units", 0.0)), 3),
        "avg_tariff": round(float(wallet.get("avg_tariff", 0.0)), 2),
        "next_bill_estimate": round(float(wallet.get("next_bill_estimate", 0.0)), 2),
        "with_amount": round(amount, 2),
        "projected_days_with_amount": projected_days,
    }


def topup_balance(user: dict[str, Any], amount: float, method: str = "UPI") -> dict[str, Any]:
    wallet = get_or_create_wallet(user)
    wallet["current_balance"] = round(float(wallet.get("current_balance", 0.0)) + float(amount), 2)
    wallet["last_topup"] = datetime.now(IST).isoformat()
    wallet["last_topup_method"] = method
    wallet["last_topup_amount"] = round(float(amount), 2)
    recompute_wallet(user)
    return wallet

