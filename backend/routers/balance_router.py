from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.auth.deps import get_current_user
from backend.schemas.requests import BalanceForecastRequest, BalanceTopupRequest
from backend.services.energy_balance import get_balance_forecast, get_balance_status, topup_balance

router = APIRouter(prefix="/balance", tags=["balance"])


@router.get("/status")
def balance_status(user=Depends(get_current_user)):
    return {"status": "success", "data": get_balance_status(user)}


@router.post("/forecast")
def balance_forecast(payload: BalanceForecastRequest, user=Depends(get_current_user)):
    return {"status": "success", "data": get_balance_forecast(user, payload.recharge_amount)}


@router.get("/forecast")
def balance_forecast_get(recharge_amount: float | None = Query(default=None, ge=0), user=Depends(get_current_user)):
    return {"status": "success", "data": get_balance_forecast(user, recharge_amount)}


@router.post("/topup")
def balance_topup(payload: BalanceTopupRequest, user=Depends(get_current_user)):
    wallet = topup_balance(user, payload.amount, payload.payment_method)
    return {
        "status": "success",
        "message": f"Top-up of Rs {round(payload.amount, 2)} completed via {payload.payment_method}",
        "data": {
            "meter_id": wallet["meter_id"],
            "meter_type": wallet["meter_type"],
            "current_balance": wallet["current_balance"],
            "estimated_daily_cost": wallet["estimated_daily_cost"],
            "estimated_days_remaining": wallet["estimated_days_remaining"],
            "next_bill_estimate": wallet["next_bill_estimate"],
            "last_topup": wallet["last_topup"],
        },
    }

