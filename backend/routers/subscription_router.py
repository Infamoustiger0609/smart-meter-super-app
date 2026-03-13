from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException

from backend.auth.deps import get_current_user
from backend.database.memory_store import store
from backend.schemas.requests import SubscriptionActivateRequest

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
IST = ZoneInfo("Asia/Kolkata")


@router.get("/plans")
def plans():
    return {"status": "success", "data": store.subscription_plans}


@router.post("/activate")
def activate(payload: SubscriptionActivateRequest, user=Depends(get_current_user)):
    if not any(p["plan_name"] == payload.plan_name for p in store.subscription_plans):
        raise HTTPException(status_code=404, detail="Plan not found")

    now = datetime.now(IST).date()
    for sub in store.subscriptions.values():
        if sub["user_id"] == user["user_id"] and sub["status"] == "ACTIVE":
            sub["status"] = "INACTIVE"
            sub["end_date"] = now.isoformat()

    subscription_id = store.next_id("subscription")
    sub = {
        "subscription_id": subscription_id,
        "user_id": user["user_id"],
        "plan_name": payload.plan_name,
        "start_date": now.isoformat(),
        "end_date": (now + timedelta(days=30)).isoformat(),
        "status": "ACTIVE",
    }
    store.subscriptions[subscription_id] = sub
    return {"status": "success", "data": sub}


@router.get("/status")
def status(user=Depends(get_current_user)):
    active = [s for s in store.subscriptions.values() if s["user_id"] == user["user_id"] and s["status"] == "ACTIVE"]
    active.sort(key=lambda x: x["start_date"], reverse=True)
    return {"status": "success", "data": active[0] if active else None}

