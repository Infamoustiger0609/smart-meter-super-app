from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth.deps import get_current_user
from backend.auth.security import create_access_token, hash_password, verify_password
from backend.database.memory_store import store
from backend.schemas.requests import LoginRequest, RegisterRequest

router = APIRouter(prefix="/auth", tags=["auth"])
IST = ZoneInfo("Asia/Kolkata")


@router.post("/register")
def register(payload: RegisterRequest):
    existing = next((u for u in store.users.values() if u["email"].lower() == payload.email.lower()), None)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    meter = next(
        (m for m in store.meters.values() if m["smart_meter_id"] == payload.smart_meter_id and not m.get("user_id")),
        None,
    )
    if meter is None:
        meter_id = store.next_id("meter")
        meter = {
            "meter_id": meter_id,
            "smart_meter_id": payload.smart_meter_id,
            "user_id": None,
            "location": "Not specified",
            "status": "ACTIVE",
        }
        store.meters[meter_id] = meter

    user_id = store.next_id("user")
    user = {
        "user_id": user_id,
        "full_name": payload.full_name,
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "role": "USER",
        "smart_meter_id": meter["meter_id"],
        "created_at": datetime.now(IST).isoformat(),
    }
    store.users[user_id] = user
    meter["user_id"] = user_id

    token = create_access_token(user_id=user_id, role=user["role"])
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": store.clone_user_safe(user),
    }


@router.post("/login")
def login(payload: LoginRequest):
    user = next((u for u in store.users.values() if u["email"].lower() == payload.email.lower()), None)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(user_id=user["user_id"], role=user["role"])
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
    }


@router.get("/profile")
def profile(user=Depends(get_current_user)):
    return {"status": "success", "data": store.clone_user_safe(user)}

