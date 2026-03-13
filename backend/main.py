from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from datetime import datetime
from zoneinfo import ZoneInfo
import logging
from pathlib import Path

from backend import simulation_state
from backend.meter import get_live_meter_reading
from backend.tariff import get_current_tariff, get_tariff_for_time, get_emission_factor_for_time
from backend.appliances import get_all_appliances, update_appliance_state, get_total_active_load
from backend.ai_engine import generate_ai_response
from backend.cost import get_current_cost, get_billing_estimate
from backend.optimizer import get_optimized_savings
from backend.scheduler import add_schedule, get_schedules, run_schedules
from backend.routers.admin_router import router as admin_router
from backend.routers.auth_router import router as auth_router
from backend.routers.billing_router import router as billing_router
from backend.routers.balance_router import router as balance_router
from backend.routers.calculator_router import router as calculator_router
from backend.routers.carbon_router import router as carbon_router
from backend.routers.chat_router import router as chat_router
from backend.routers.consumption_router import router as consumption_router
from backend.routers.help_router import router as help_router
from backend.routers.payment_router import router as payment_router
from backend.routers.service_router import router as service_router
from backend.routers.solar_router import router as solar_router
from backend.routers.subscription_router import router as subscription_router
from backend.services.bootstrap import initialize_demo_state

app = FastAPI(title="Smart Meter Super App")
logger = logging.getLogger("superapp")
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
INDEX_FILE = FRONTEND_DIR / "index.html"

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def bootstrap_seed_data():
    initialize_demo_state()


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        logger.info("%s %s -> %s", request.method, request.url.path, response.status_code)
        return response
    except Exception as exc:
        logger.exception("Unhandled error at %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})


class ToggleRequest(BaseModel):
    state: bool


class WhatIfRequest(BaseModel):
    device_ids: list[str]
    target_time: str  # HH:MM


class ScheduleRequest(BaseModel):
    device_id: str
    run_time: str  # HH:MM


class TimeSimulationRequest(BaseModel):
    time_str: str  # HH:MM


class BillingRequest(BaseModel):
    monthly_kwh: Optional[float] = None


def _format_currency(value: float) -> str:
    return f"Rs {round(value, 2)}"


def _build_rule_based_recommendation() -> dict:
    appliances = get_all_appliances()
    now_ctx = get_current_tariff()["data"]
    now_tariff = float(now_ctx["effective_tariff"])

    flexible_on = []
    total_flexible_on_units = 0.0
    for device in appliances.values():
        if device["flexible"] and device["state"]:
            flexible_on.append(device["name"])
            total_flexible_on_units += float(device["units_per_hour"])

    today = datetime.now(ZoneInfo("Asia/Kolkata"))
    best_time = None
    best_tariff = float("inf")
    for hour in range(24):
        slot = today.replace(hour=hour, minute=0, second=0, microsecond=0)
        slot_tariff = float(get_tariff_for_time(slot))
        if slot_tariff < best_tariff:
            best_tariff = slot_tariff
            best_time = slot

    savings = max((now_tariff - best_tariff) * total_flexible_on_units, 0.0)
    current_time = simulation_state.SIMULATED_TIME or datetime.now(ZoneInfo("Asia/Kolkata"))
    current_emission = float(get_emission_factor_for_time(current_time))
    optimal_emission = float(get_emission_factor_for_time(best_time))
    co2_saved = max((current_emission - optimal_emission) * total_flexible_on_units, 0.0)

    if not flexible_on:
        message = (
            "No flexible appliance is ON right now. Run flexible loads during 04:00-10:00 IST "
            f"for best tariff ({_format_currency(best_tariff)}/kWh)."
        )
    elif savings <= 0.01:
        message = (
            f"Current setup is near-optimal at {_format_currency(now_tariff)}/kWh. "
            "No urgent shift needed."
        )
    else:
        message = (
            f"Shift {', '.join(flexible_on)} to {best_time.strftime('%H:%M')} IST. "
            f"Estimated savings: {_format_currency(savings)}/h, CO2 reduction: {round(co2_saved, 3)} kg/h."
        )

    return {
        "message": message,
        "recommended_time": best_time.strftime("%H:%M"),
        "savings_per_hour": round(savings, 2),
        "co2_saved_per_hour": round(co2_saved, 3),
        "current_tariff": round(now_tariff, 2),
        "optimal_tariff": round(best_tariff, 2),
        "active_flexible_devices": flexible_on,
    }


@app.get("/")
async def serve_frontend():
    if INDEX_FILE.exists():
        return FileResponse(str(INDEX_FILE))
    return {"status": "Backend running successfully"}


@app.get("/meter/live")
def live_meter():
    return get_live_meter_reading()


@app.get("/tariff/current")
def current_tariff():
    return get_current_tariff()


@app.get("/appliances")
def list_appliances():
    return get_all_appliances()


@app.post("/appliance/toggle/{appliance_id}")
def set_appliance_state(appliance_id: str, request: ToggleRequest):
    updated = update_appliance_state(appliance_id, request.state)
    if not updated:
        return {"status": "error", "message": "Appliance not found"}

    device = get_all_appliances()[appliance_id]
    return {
        "status": "success",
        "device_id": appliance_id,
        "state": device["state"],
        "name": device["name"],
    }


@app.get("/cost/current")
def current_cost():
    return get_current_cost()


@app.get("/billing/estimate")
def billing_estimate(monthly_kwh: Optional[float] = None):
    return get_billing_estimate(monthly_kwh)


@app.get("/optimize")
def optimize():
    return get_optimized_savings()


@app.get("/devices")
def get_devices():
    return get_all_appliances()


@app.get("/system/status")
def system_status():
    run_schedules()

    return {
        "status": "success",
        "data": {
            "devices": get_all_appliances(),
            "total_load_kwh": round(get_total_active_load(), 2),
            "tariff": get_current_tariff(),
            "cost": get_current_cost(),
            "optimization": get_optimized_savings(),
            "billing": get_billing_estimate(),
        },
    }


@app.post("/simulate/time")
def set_simulation_time(payload: TimeSimulationRequest):
    try:
        simulated = datetime.strptime(payload.time_str, "%H:%M").replace(
            year=datetime.now().year,
            month=datetime.now().month,
            day=datetime.now().day,
            tzinfo=ZoneInfo("Asia/Kolkata"),
        )

        simulation_state.SIMULATED_TIME = simulated

        return {
            "status": "success",
            "simulated_time": simulated.strftime("%Y-%m-%d %H:%M:%S"),
            "message": "Simulation time updated",
        }

    except ValueError:
        return {
            "status": "error",
            "message": "Invalid time format. Use HH:MM (24-hour format)",
        }


@app.post("/simulate/what-if")
def simulate_what_if(request: WhatIfRequest):
    appliances = get_all_appliances()

    total_units = 0.0
    selected_devices = []

    for device_id in request.device_ids:
        if device_id not in appliances:
            return {"status": "error", "message": f"Invalid device_id: {device_id}"}

        total_units += appliances[device_id]["units_per_hour"]
        selected_devices.append(appliances[device_id]["name"])

    try:
        target_dt = datetime.strptime(request.target_time, "%H:%M").replace(
            year=datetime.now().year,
            month=datetime.now().month,
            day=datetime.now().day,
            tzinfo=ZoneInfo("Asia/Kolkata"),
        )
    except ValueError:
        return {"status": "error", "message": "Invalid time format. Use HH:MM"}

    current_tariff = round(get_current_tariff()["data"]["effective_tariff"], 2)
    target_tariff = round(get_tariff_for_time(target_dt), 2)

    current_cost_val = total_units * current_tariff
    target_cost_val = total_units * target_tariff
    savings = current_cost_val - target_cost_val

    if simulation_state.SIMULATED_TIME:
        current_time_for_emission = simulation_state.SIMULATED_TIME
    else:
        current_time_for_emission = datetime.now(ZoneInfo("Asia/Kolkata"))

    current_emission_factor = get_emission_factor_for_time(current_time_for_emission)
    target_emission_factor = get_emission_factor_for_time(target_dt)

    current_co2 = total_units * current_emission_factor
    target_co2 = total_units * target_emission_factor
    co2_saved = current_co2 - target_co2

    return {
        "status": "success",
        "devices": selected_devices,
        "total_units_per_hour": round(total_units, 2),
        "current_tariff": current_tariff,
        "target_tariff": target_tariff,
        "cost_now_per_hour": round(current_cost_val, 2),
        "cost_at_target_time_per_hour": round(target_cost_val, 2),
        "savings_per_hour": round(savings, 2),
        "co2_now_kg_per_hour": round(current_co2, 2),
        "co2_at_target_time_kg_per_hour": round(target_co2, 2),
        "co2_saved_kg_per_hour": round(co2_saved, 2),
    }


@app.get("/ai/recommend")
def ai_recommend():
    system_data = {
        "devices": get_all_appliances(),
        "total_load": get_total_active_load(),
        "tariff": get_current_tariff(),
        "cost": get_current_cost(),
    }

    prompt = f"""
You are an energy assistant.

RULES:
- Do NOT calculate anything
- Only use given data
- Currency is Rs
- Keep response under 60 words

DATA:
{system_data}

TASK:
Suggest if user should run flexible appliances now or later.
If later, mention off-peak hours (04:00-10:00 IST).
Keep it simple.
"""

    fallback = _build_rule_based_recommendation()
    try:
        ai_text = generate_ai_response([{"role": "user", "content": prompt}]).strip()
        if not ai_text:
            ai_text = fallback["message"]
        source = "ai_engine"
    except Exception as exc:
        ai_text = fallback["message"]
        source = f"rule-based-fallback ({type(exc).__name__})"

    return {
        "status": "success",
        "ai_response": ai_text,
        "source": source,
        "context": fallback,
    }


@app.get("/ai/auto-recommend")
def auto_recommend():
    appliances = get_all_appliances()

    flexible_devices = []
    total_units = 0.0

    for device_id, device in appliances.items():
        if device["flexible"]:
            flexible_devices.append((device_id, device))
            total_units += device["units_per_hour"]

    if not flexible_devices:
        return {"status": "info", "message": "No flexible devices available"}

    best_time = None
    best_tariff = float("inf")

    today = datetime.now(ZoneInfo("Asia/Kolkata"))

    for hour in range(24):
        test_time = today.replace(hour=hour, minute=0, second=0, microsecond=0)
        tariff = get_tariff_for_time(test_time)
        if tariff < best_tariff:
            best_tariff = tariff
            best_time = test_time

    current_tariff_val = get_current_tariff()["data"]["effective_tariff"]

    current_cost_val = total_units * current_tariff_val
    optimal_cost = total_units * best_tariff
    savings = current_cost_val - optimal_cost

    current_time = simulation_state.SIMULATED_TIME or datetime.now(ZoneInfo("Asia/Kolkata"))
    current_emission = get_emission_factor_for_time(current_time)
    optimal_emission = get_emission_factor_for_time(best_time)

    current_co2 = total_units * current_emission
    optimal_co2 = total_units * optimal_emission
    co2_saved = current_co2 - optimal_co2

    device_names = [device["name"] for _, device in flexible_devices]

    system_data = {
        "devices": device_names,
        "best_time": best_time.strftime("%H:%M"),
        "current_tariff": round(current_tariff_val, 2),
        "optimal_tariff": round(best_tariff, 2),
        "savings": round(savings, 2),
        "co2_saved": round(co2_saved, 2),
    }

    prompt = f"""
You are an energy assistant.

RULES:
- Do NOT calculate anything
- Only use given data
- Currency is Rs
- Keep under 50 words

DATA:
{system_data}

IMPORTANT:
If savings = 0:
Say system is already optimized and no change needed.

Otherwise:
Suggest best time, savings, and CO2 reduction.
"""

    fallback = _build_rule_based_recommendation()
    try:
        ai_text = generate_ai_response([{"role": "user", "content": prompt}]).strip()
        if not ai_text:
            ai_text = fallback["message"]
        source = "ai_engine"
    except Exception as exc:
        ai_text = fallback["message"]
        source = f"rule-based-fallback ({type(exc).__name__})"

    return {
        "status": "success",
        "devices": device_names,
        "recommended_time": best_time.strftime("%H:%M") if best_time else "04:00",
        "current_tariff": round(current_tariff_val, 2),
        "optimal_tariff": round(best_tariff, 2),
        "savings_per_hour": round(savings, 2),
        "co2_saved_per_hour": round(co2_saved, 2),
        "ai_recommendation": ai_text,
        "source": source,
        "fallback_context": fallback,
    }


@app.post("/schedule")
def schedule_device(request: ScheduleRequest):
    return add_schedule(request.device_id, request.run_time)


@app.get("/schedule")
def view_schedule():
    return get_schedules()


# Super App feature routers (in-memory prototype; DB can be swapped in later)
app.include_router(auth_router)
app.include_router(billing_router)
app.include_router(balance_router)
app.include_router(payment_router)
app.include_router(consumption_router)
app.include_router(service_router)
app.include_router(subscription_router)
app.include_router(calculator_router)
app.include_router(carbon_router)
app.include_router(help_router)
app.include_router(solar_router)
app.include_router(admin_router)
app.include_router(chat_router)


