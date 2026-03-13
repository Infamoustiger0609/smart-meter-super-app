from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from backend.auth.deps import get_current_user
from backend.database.memory_store import store

router = APIRouter(prefix="/consumption", tags=["consumption"])
IST = ZoneInfo("Asia/Kolkata")


def _user_meter_id(user):
    return user["smart_meter_id"]


def _records_for_meter(meter_id: str):
    recs = [r for r in store.consumption_records.values() if r["meter_id"] == meter_id]
    recs.sort(key=lambda x: x["timestamp"])
    return recs


@router.get("/daily")
def consumption_daily(user=Depends(get_current_user)):
    meter_id = _user_meter_id(user)
    today = datetime.now(IST).date()
    bucket = defaultdict(float)

    for rec in _records_for_meter(meter_id):
        ts = datetime.fromisoformat(rec["timestamp"]).astimezone(IST)
        if ts.date() == today:
            bucket[ts.hour] += float(rec["units"])

    data = [{"hour": f"{h:02d}:00", "units": round(bucket[h], 3)} for h in range(24)]
    return {"status": "success", "meter_id": meter_id, "data": data}


@router.get("/monthly")
def consumption_monthly(user=Depends(get_current_user)):
    meter_id = _user_meter_id(user)
    now = datetime.now(IST)
    start = (now - timedelta(days=30)).date()
    bucket = defaultdict(float)

    for rec in _records_for_meter(meter_id):
        ts = datetime.fromisoformat(rec["timestamp"]).astimezone(IST)
        if ts.date() >= start:
            bucket[ts.date().isoformat()] += float(rec["units"])

    data = [{"day": k, "units": round(v, 3)} for k, v in sorted(bucket.items())]
    return {"status": "success", "meter_id": meter_id, "data": data}


@router.get("/yearly")
def consumption_yearly(user=Depends(get_current_user)):
    meter_id = _user_meter_id(user)
    bucket = defaultdict(float)

    for rec in _records_for_meter(meter_id):
        ts = datetime.fromisoformat(rec["timestamp"]).astimezone(IST)
        key = ts.strftime("%Y-%m")
        bucket[key] += float(rec["units"])

    data = [{"month": k, "units": round(v, 3)} for k, v in sorted(bucket.items())]
    return {"status": "success", "meter_id": meter_id, "data": data}

