from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from backend.auth.deps import get_current_user
from backend.database.memory_store import store

router = APIRouter(prefix="/solar", tags=["solar"])
IST = ZoneInfo("Asia/Kolkata")


@router.get("/production")
def production(user=Depends(get_current_user)):
    system = next((s for s in store.solar_systems.values() if s["user_id"] == user["user_id"]), None)
    if not system:
        return {"status": "info", "message": "No solar system linked", "data": None}

    rows = [r for r in store.solar_generation.values() if r["system_id"] == system["system_id"]]
    rows.sort(key=lambda x: x["timestamp"])
    today = datetime.now(IST).date()
    hourly = defaultdict(float)

    for row in rows:
        ts = datetime.fromisoformat(row["timestamp"]).astimezone(IST)
        if ts.date() == today:
            hourly[ts.hour] += float(row["units_generated"])

    hourly_data = [{"hour": f"{h:02d}:00", "units_generated": round(hourly[h], 3)} for h in range(24)]
    total_today = round(sum(x["units_generated"] for x in hourly_data), 3)

    return {
        "status": "success",
        "data": {
            "system": system,
            "total_generated_today": total_today,
            "hourly": hourly_data,
        },
    }


@router.get("/net-metering")
def net_metering(user=Depends(get_current_user)):
    meter_id = user["smart_meter_id"]
    load = sum(float(r["units"]) for r in store.consumption_records.values() if r["meter_id"] == meter_id)

    system = next((s for s in store.solar_systems.values() if s["user_id"] == user["user_id"]), None)
    generated = 0.0
    if system:
        generated = sum(
            float(r["units_generated"])
            for r in store.solar_generation.values()
            if r["system_id"] == system["system_id"]
        )

    grid_import = max(load - generated, 0)
    grid_export = max(generated - load, 0)
    savings = round(generated * 6.0, 2)

    return {
        "status": "success",
        "data": {
            "consumed_units": round(load, 3),
            "generated_units": round(generated, 3),
            "grid_import_units": round(grid_import, 3),
            "grid_export_units": round(grid_export, 3),
            "estimated_savings_rs": savings,
        },
    }

