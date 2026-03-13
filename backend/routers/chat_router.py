from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.auth.deps import get_current_user
from backend.database.memory_store import store
from backend.schemas.requests import ChatQueryRequest
from backend.services.ai_agent import tool_agent_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/query")
def chat_query(payload: ChatQueryRequest, user=Depends(get_current_user)):
    return tool_agent_service.query(user=user, message=payload.message, session_id=payload.session_id)


@router.get("/history")
def chat_history(session_id: str | None = Query(default=None), user=Depends(get_current_user)):
    key = f"{user['user_id']}:{session_id or 'default'}"
    history = store.chat_sessions.get(key, [])
    return {"status": "success", "session_id": session_id or "default", "history": history[-20:]}

