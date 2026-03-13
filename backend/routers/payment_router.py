from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException

from backend.auth.deps import get_current_user
from backend.database.memory_store import store
from backend.schemas.requests import PaymentRequest
from backend.services.energy_balance import recompute_wallet

router = APIRouter(prefix="/payment", tags=["payment"])
IST = ZoneInfo("Asia/Kolkata")


@router.post("/pay")
def pay_bill(payload: PaymentRequest, user=Depends(get_current_user)):
    bill = store.bills.get(payload.bill_id)
    if not bill or bill["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Bill not found")

    if bill["status"] == "PAID":
        return {"status": "info", "message": "Bill already paid", "data": bill}

    status_val = "SUCCESS" if payload.amount >= float(bill["amount"]) else "FAILED"
    payment_id = store.next_id("payment")
    payment = {
        "payment_id": payment_id,
        "bill_id": bill["bill_id"],
        "user_id": user["user_id"],
        "amount": round(payload.amount, 2),
        "payment_method": payload.payment_method,
        "transaction_id": f"TXN-{int(datetime.now(IST).timestamp())}-{payment_id}",
        "payment_status": status_val,
        "payment_date": datetime.now(IST).isoformat(),
    }
    store.payments[payment_id] = payment

    if status_val == "SUCCESS":
        bill["status"] = "PAID"
        recompute_wallet(user)

    return {"status": "success", "data": payment}


@router.get("/history")
def payment_history(user=Depends(get_current_user)):
    records = [p for p in store.payments.values() if p["user_id"] == user["user_id"]]
    records.sort(key=lambda x: x["payment_date"], reverse=True)
    return {"status": "success", "data": records}

