from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query

from backend import simulation_state
from backend.appliances import get_total_active_load
from backend.auth.deps import get_current_user
from backend.database.memory_store import store
from backend.tariff import get_emission_factor_for_time

router = APIRouter(prefix="/carbon", tags=["carbon"])
IST = ZoneInfo("Asia/Kolkata")


@router.get("/current")
def carbon_current(user=Depends(get_current_user)):
    now = simulation_state.SIMULATED_TIME or datetime.now(IST)
    active_load = float(get_total_active_load())
    emission_factor = float(get_emission_factor_for_time(now))
    current_kg_per_hour = active_load * emission_factor

    return {
        "status": "success",
        "data": {
            "as_of": now.isoformat(),
            "active_load_kwh_per_hour": round(active_load, 3),
            "emission_factor_kg_per_kwh": round(emission_factor, 3),
            "current_kg_co2_per_hour": round(current_kg_per_hour, 3),
            "meter_id": user["smart_meter_id"],
        },
    }


@router.get("/timeline")
def carbon_timeline(
    period: str = Query(default="today", pattern="^(today|week|month)$"),
    user=Depends(get_current_user),
):
    now = simulation_state.SIMULATED_TIME or datetime.now(IST)
    meter_id = user["smart_meter_id"]

    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now - timedelta(days=7)
    else:
        start = now - timedelta(days=30)

    total_units = 0.0
    total_co2 = 0.0
    sample_count = 0

    for rec in store.consumption_records.values():
        if rec["meter_id"] != meter_id:
            continue
        ts = datetime.fromisoformat(rec["timestamp"]).astimezone(IST)
        if ts < start or ts > now:
            continue
        units = float(rec["units"])
        factor = float(get_emission_factor_for_time(ts))
        total_units += units
        total_co2 += units * factor
        sample_count += 1

    avg_factor = (total_co2 / total_units) if total_units > 0 else 0.0

    return {
        "status": "success",
        "data": {
            "period": period,
            "from": start.isoformat(),
            "to": now.isoformat(),
            "meter_id": meter_id,
            "samples": sample_count,
            "total_units_kwh": round(total_units, 3),
            "total_kg_co2": round(total_co2, 3),
            "avg_emission_factor_kg_per_kwh": round(avg_factor, 3),
        },
    }


