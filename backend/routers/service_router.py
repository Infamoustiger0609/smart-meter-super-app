from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException

from backend.auth.deps import get_current_user
from backend.database.memory_store import store
from backend.schemas.requests import ServiceRequestCreate

router = APIRouter(prefix="/service", tags=["service"])
IST = ZoneInfo("Asia/Kolkata")


@router.post("/request")
def create_request(payload: ServiceRequestCreate, user=Depends(get_current_user)):
    request_id = store.next_id("request")
    now = datetime.now(IST).isoformat()
    req = {
        "request_id": request_id,
        "user_id": user["user_id"],
        "meter_id": user["smart_meter_id"],
        "request_type": payload.request_type,
        "description": payload.description,
        "status": "OPEN",
        "created_at": now,
        "updated_at": now,
        "timeline": [{"status": "OPEN", "note": "Request created", "at": now}],
    }
    store.service_requests[request_id] = req
    return {"status": "success", "data": req}


@router.get("/history")
def request_history(user=Depends(get_current_user)):
    data = [r for r in store.service_requests.values() if r["user_id"] == user["user_id"]]
    data.sort(key=lambda x: x["created_at"], reverse=True)
    return {"status": "success", "data": data}


@router.get("/{request_id}")
def request_detail(request_id: str, user=Depends(get_current_user)):
    req = store.service_requests.get(request_id)
    if not req or req["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Service request not found")
    return {"status": "success", "data": req}


@router.post("/emergency")
def create_emergency_request(payload: ServiceRequestCreate, user=Depends(get_current_user)):
    request_id = store.next_id("request")
    now = datetime.now(IST).isoformat()
    req = {
        "request_id": request_id,
        "user_id": user["user_id"],
        "meter_id": user["smart_meter_id"],
        "request_type": f"EMERGENCY: {payload.request_type}",
        "description": payload.description,
        "status": "OPEN",
        "priority": "HIGH",
        "created_at": now,
        "updated_at": now,
        "timeline": [{"status": "OPEN", "note": "Emergency request created — electrician will contact within 1 hour", "at": now}],
    }
    store.service_requests[request_id] = req
    return {"status": "success", "data": req}


@router.post("/discom")
def create_discom_request(payload: ServiceRequestCreate, user=Depends(get_current_user)):
    request_id = store.next_id("request")
    now = datetime.now(IST).isoformat()
    req = {
        "request_id": request_id,
        "user_id": user["user_id"],
        "meter_id": user["smart_meter_id"],
        "request_type": f"DISCOM: {payload.request_type}",
        "description": payload.description,
        "status": "OPEN",
        "created_at": now,
        "updated_at": now,
        "timeline": [{"status": "OPEN", "note": "DISCOM request submitted", "at": now}],
    }
    store.service_requests[request_id] = req
    return {"status": "success", "data": req}

