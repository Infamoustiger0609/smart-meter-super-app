from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from backend.auth.deps import get_current_user
from backend.database.memory_store import store
from backend.schemas.requests import HelpContactRequest

router = APIRouter(prefix="/help", tags=["help"])
IST = ZoneInfo("Asia/Kolkata")


@router.get("/faqs")
def faqs():
    return {"status": "success", "data": store.help_faqs}


@router.post("/contact")
def contact(payload: HelpContactRequest, user=Depends(get_current_user)):
    contact_id = store.next_id("contact")
    rec = {
        "contact_id": contact_id,
        "user_id": user["user_id"],
        "subject": payload.subject,
        "message": payload.message,
        "created_at": datetime.now(IST).isoformat(),
        "status": "RECEIVED",
    }
    store.contact_messages[contact_id] = rec
    return {
        "status": "success",
        "message": "Support request submitted. We will reach out shortly.",
        "data": rec,
    }

