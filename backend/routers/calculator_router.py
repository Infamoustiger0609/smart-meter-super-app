from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.requests import ConsumptionCalculatorRequest
from backend.tariff import get_current_tariff

router = APIRouter(prefix="/calculator", tags=["calculator"])


@router.post("/consumption")
def calculate(payload: ConsumptionCalculatorRequest):
    units_per_day = (payload.power_rating_watts / 1000.0) * payload.usage_hours_per_day
    units_per_month = units_per_day * 30
    tariff = payload.tariff_per_kwh or get_current_tariff()["data"]["effective_tariff"]
    monthly_cost = units_per_month * tariff

    return {
        "status": "success",
        "data": {
            "appliance_type": payload.appliance_type,
            "daily_consumption_kwh": round(units_per_day, 3),
            "monthly_consumption_kwh": round(units_per_month, 3),
            "tariff_per_kwh": round(tariff, 2),
            "monthly_cost": round(monthly_cost, 2),
        },
    }

