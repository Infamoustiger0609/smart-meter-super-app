from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.auth.deps import require_roles
from backend.appliances import get_total_active_load
from backend.database.memory_store import store
from backend.schemas.requests import AdminBillGenerateRequest, ServiceStatusUpdate
from backend.tariff import get_emission_factor_for_time

router = APIRouter(prefix="/admin", tags=["admin"])
IST = ZoneInfo("Asia/Kolkata")


class UserStatusUpdate(BaseModel):
    status: str = Field(pattern="^(ACTIVE|SUSPENDED)$")


class MeterResetRequest(BaseModel):
    note: str | None = None


@router.get("/users")
def admin_users(admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    data = [store.clone_user_safe(user) for user in store.users.values()]
    return {"status": "success", "data": data}


@router.patch("/users/{user_id}/status")
def admin_user_status(user_id: str, payload: UserStatusUpdate, admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    user = store.users.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["account_status"] = payload.status
    user["updated_at"] = datetime.now(IST).isoformat()
    return {"status": "success", "data": store.clone_user_safe(user)}


@router.get("/meters")
def admin_meters(admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    return {"status": "success", "data": list(store.meters.values())}


@router.post("/meters/{meter_id}/reset")
def admin_meter_reset(meter_id: str, payload: MeterResetRequest, admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    meter = store.meters.get(meter_id)
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    meter["status"] = "ACTIVE"
    meter["last_reset_at"] = datetime.now(IST).isoformat()
    meter["last_reset_note"] = payload.note or "Connection reset from admin portal"
    return {"status": "success", "data": meter}


@router.get("/requests")
def admin_requests(admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    rows = sorted(store.service_requests.values(), key=lambda x: x["updated_at"], reverse=True)
    return {"status": "success", "data": rows}


@router.patch("/requests/{request_id}")
def admin_update_request(request_id: str, payload: ServiceStatusUpdate, admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    req = store.service_requests.get(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    now = datetime.now(IST).isoformat()
    req["status"] = payload.status
    req["updated_at"] = now
    req.setdefault("timeline", []).append({"status": payload.status, "note": payload.note, "at": now})
    return {"status": "success", "data": req}


@router.get("/payments")
def admin_payments(admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    rows = sorted(store.payments.values(), key=lambda x: x["payment_date"], reverse=True)
    return {"status": "success", "data": rows}


@router.post("/billing/generate")
def admin_generate_bill(payload: AdminBillGenerateRequest, admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    user = store.users.get(payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    bill_id = store.next_id("bill")
    bill = {
        "bill_id": bill_id,
        "user_id": payload.user_id,
        "meter_id": user["smart_meter_id"],
        "billing_month": payload.billing_month,
        "units_consumed": round(payload.units_consumed, 2),
        "amount": round(payload.units_consumed * 6.0, 2),
        "due_date": payload.due_date,
        "status": "UNPAID",
        "pdf_url": f"/mock/bills/{bill_id}.pdf",
    }
    store.bills[bill_id] = bill
    return {"status": "success", "data": bill}


@router.get("/analytics/summary")
def admin_summary(admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    paid = sum(float(b["amount"]) for b in store.bills.values() if b["status"] == "PAID")
    unpaid = sum(float(b["amount"]) for b in store.bills.values() if b["status"] == "UNPAID")
    return {
        "status": "success",
        "data": {
            "total_users": len(store.users),
            "total_meters": len(store.meters),
            "open_requests": sum(1 for r in store.service_requests.values() if r["status"] in {"OPEN", "IN_PROGRESS"}),
            "paid_revenue": round(paid, 2),
            "outstanding_revenue": round(unpaid, 2),
            "active_subscriptions": sum(1 for s in store.subscriptions.values() if s["status"] == "ACTIVE"),
            "solar_systems": len(store.solar_systems),
            "consumption_records": len(store.consumption_records),
        },
    }


@router.get("/solar-systems")
def admin_solar_systems(admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    systems = sorted(store.solar_systems.values(), key=lambda x: x["installation_date"], reverse=True)
    return {"status": "success", "data": systems}


@router.get("/consumption/summary")
def admin_consumption_summary(admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    meter_totals = defaultdict(float)
    monthly_totals = defaultdict(float)

    for record in store.consumption_records.values():
        meter_totals[record["meter_id"]] += float(record["units"])
        month_key = record["timestamp"][:7]
        monthly_totals[month_key] += float(record["units"])

    top_meters = [
        {"meter_id": meter_id, "units": round(units, 2)}
        for meter_id, units in sorted(meter_totals.items(), key=lambda x: x[1], reverse=True)[:20]
    ]
    month_series = [
        {"month": month, "units": round(units, 2)}
        for month, units in sorted(monthly_totals.items())
    ]

    return {"status": "success", "data": {"top_meters": top_meters, "monthly": month_series}}


@router.get("/consumption/hourly")
def admin_consumption_hourly(admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    hourly = defaultdict(float)
    today = datetime.now(IST).date()
    for record in store.consumption_records.values():
        ts = datetime.fromisoformat(record["timestamp"]).astimezone(IST)
        if ts.date() != today:
            continue
        hourly[ts.hour] += float(record["units"])
    data = [{"hour": f"{h:02d}:00", "units": round(hourly.get(h, 0.0), 2)} for h in range(24)]
    return {"status": "success", "data": data}


@router.get("/consumption/daily")
def admin_consumption_daily(admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    daily = defaultdict(float)
    for record in store.consumption_records.values():
        ts = datetime.fromisoformat(record["timestamp"]).astimezone(IST)
        daily[ts.date().isoformat()] += float(record["units"])
    rows = sorted(daily.items())[-30:]
    return {"status": "success", "data": [{"day": day, "units": round(units, 2)} for day, units in rows]}


@router.get("/grid/intelligence")
def admin_grid_intelligence(admin=Depends(require_roles("ADMIN", "UTILITY_OPERATOR"))):
    total_delivered = sum(float(r["units"]) for r in store.consumption_records.values())
    now = datetime.now(IST)
    current_load = round(get_total_active_load(), 2)
    current_emission_factor = get_emission_factor_for_time(now)
    current_estimated_emissions = round(current_load * current_emission_factor, 3)

    # Basic demand projection from trailing 24h mean.
    trailing_24h = []
    cutoff = now.timestamp() - (24 * 3600)
    for record in store.consumption_records.values():
        ts = datetime.fromisoformat(record["timestamp"]).astimezone(IST).timestamp()
        if ts >= cutoff:
            trailing_24h.append(float(record["units"]))
    avg_hourly = round(sum(trailing_24h) / len(trailing_24h), 3) if trailing_24h else 0.0
    projected_24h = round(avg_hourly * 24, 2)

    active_meters = sum(1 for m in store.meters.values() if m.get("status") == "ACTIVE")
    offline_meters = sum(1 for m in store.meters.values() if m.get("status") != "ACTIVE")

    health = "GOOD"
    if offline_meters > max(2, int(len(store.meters) * 0.15)):
        health = "ATTENTION"
    if offline_meters > max(5, int(len(store.meters) * 0.3)):
        health = "CRITICAL"

    return {
        "status": "success",
        "data": {
            "total_energy_delivered_kwh": round(total_delivered, 2),
            "current_grid_load_kwh": current_load,
            "estimated_carbon_kg_per_hour": current_estimated_emissions,
            "projected_demand_next_24h_kwh": projected_24h,
            "active_meters": active_meters,
            "offline_meters": offline_meters,
            "grid_health": health,
        },
    }

