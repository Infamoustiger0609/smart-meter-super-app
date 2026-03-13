from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.auth.deps import get_current_user
from backend.database.memory_store import store

router = APIRouter(prefix="/billing", tags=["billing"])
IST = ZoneInfo("Asia/Kolkata")


def _user_bills(user_id: str):
    return sorted(
        [b for b in store.bills.values() if b["user_id"] == user_id],
        key=lambda x: x["billing_month"],
        reverse=True,
    )


@router.get("/history")
def billing_history(user=Depends(get_current_user)):
    return {"status": "success", "data": _user_bills(user["user_id"]) }


@router.get("/current")
def current_bill(user=Depends(get_current_user)):
    bills = _user_bills(user["user_id"])
    unpaid = [b for b in bills if b["status"] == "UNPAID"]
    current = unpaid[0] if unpaid else (bills[0] if bills else None)

    if not current:
        current = {
            "bill_id": "none",
            "user_id": user["user_id"],
            "meter_id": user["smart_meter_id"],
            "billing_month": datetime.now(IST).strftime("%Y-%m"),
            "units_consumed": 0,
            "amount": 0,
            "due_date": datetime.now(IST).date().isoformat(),
            "status": "UNPAID",
            "pdf_url": None,
        }
    return {"status": "success", "data": current}


@router.get("/{bill_id}")
def billing_detail(bill_id: str, user=Depends(get_current_user)):
    bill = store.bills.get(bill_id)
    if not bill or bill["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {"status": "success", "data": bill}


@router.get("/{bill_id}/download")
def billing_download_link(bill_id: str, user=Depends(get_current_user)):
    bill = store.bills.get(bill_id)
    if not bill or bill["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {
        "status": "success",
        "data": {
            "bill_id": bill_id,
            "download_url": bill.get("pdf_url") or f"/mock/bills/{bill_id}.pdf",
        },
    }


@router.get("/admin/all")
def all_bills(month: str | None = Query(default=None)):
    # lightweight open endpoint for quick demo compatibility
    data = list(store.bills.values())
    if month:
        data = [b for b in data if b["billing_month"] == month]
    return {"status": "success", "data": data}

