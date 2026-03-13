from __future__ import annotations

from datetime import datetime, timedelta
import json
import logging
import re
from typing import Any
from zoneinfo import ZoneInfo

from backend.appliances import get_all_appliances, update_appliance_state
from backend.ai_engine import generate_ai_response
from backend.database.memory_store import store
from backend.scheduler import add_schedule, remove_schedule
from backend import simulation_state
from backend.services.chat_rag import chat_rag_service
from backend.services.energy_balance import get_balance_status
from backend.tariff import get_current_tariff, get_emission_factor_for_time

IST = ZoneInfo("Asia/Kolkata")
RAG_CONFIDENCE_THRESHOLD = 0.65
TOOL_PATH = "TOOL_PATH"
RAG_PATH = "RAG_PATH"
LLM_FALLBACK_PATH = "LLM_FALLBACK_PATH"
logger = logging.getLogger("superapp.chat")

SYSTEM_PROMPT = """You are the AI assistant for the SMART METER SUPER APP.

Your task is to interpret the user's message and choose the correct system tool.

Available tools:

navigate_page

toggle_appliance

get_bill

get_balance

get_consumption

get_solar_data

create_service_request

get_tariff_info

schedule_appliance

get_carbon_footprint

Rules:

Always return JSON.

Never return explanations.

Choose the best tool for the request.

Extract parameters from natural language.

If multiple devices are mentioned return a list.

If the user asks about knowledge (tariffs, electricity concepts), respond with \"knowledge_query\".
"""

PAGE_MAP = {
    "overview": "overview",
    "appliances": "appliances",
    "billing": "billing",
    "payments": "payments",
    "solar_dashboard": "solar",
    "service_requests": "service",
    "consumption_analytics": "analytics",
    "energy_analytics": "analytics",
    "settings": "settings",
}

NAV_PATH_MAP = {
    "overview": "/app/",
    "appliances": "/app/#appliances",
    "billing": "/app/#billing",
    "payments": "/app/#payments",
    "solar": "/app/#solar",
    "service": "/app/#service",
    "analytics": "/app/#analytics",
    "settings": "/app/#settings",
}

DEVICE_ALIAS = {
    "ac": "air conditioner",
    "air conditioner": "air conditioner",
    "cooling unit": "air conditioner",
    "fan": "ceiling fan",
    "fans": "ceiling fan",
    "ceiling fan": "ceiling fan",
    "light": "led lights",
    "lights": "led lights",
    "lamp": "led lights",
    "fridge": "refrigerator",
    "refrigerator": "refrigerator",
    "washing_machine": "washing machine",
    "washing machine": "washing machine",
    "geyser": "geyser",
    "router": "wi-fi router",
    "wi-fi router": "wi-fi router",
}

ALWAYS_ON = {"refrigerator"}


class ToolAgentError(RuntimeError):
    pass


def _ollama_generate(prompt: str) -> str | None:
    try:
        return generate_ai_response([{"role": "user", "content": prompt}])
    except Exception:
        return None


def _extract_json(text: str) -> dict[str, Any] | None:
    text = (text or "").strip()
    if not text:
        return None

    try:
        out = json.loads(text)
        return out if isinstance(out, dict) else None
    except Exception:
        pass

    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        out = json.loads(m.group(0))
        return out if isinstance(out, dict) else None
    except Exception:
        return None


def interpret_command(user_message: str) -> dict[str, Any]:
    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        "Return only valid JSON with schema:\n"
        '{"tool":"<tool_name>","parameters":{...}}\n\n'
        f"User: {user_message}\n"
    )

    raw = _ollama_generate(prompt)
    parsed = _extract_json(raw or "")
    if not parsed:
        raise ToolAgentError("Model did not return valid JSON tool call")

    tool = str(parsed.get("tool") or "").strip()
    params = parsed.get("parameters")
    if not tool:
        raise ToolAgentError("Missing tool in model output")
    if params is None:
        params = {}
    if not isinstance(params, dict):
        raise ToolAgentError("Tool parameters must be a JSON object")

    return {"tool": tool, "parameters": params}


def _extract_time_text(text: str) -> str | None:
    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", text)
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2) or 0)
    suffix = (m.group(3) or "").lower()
    if suffix == "pm" and hour < 12:
        hour += 12
    if suffix == "am" and hour == 12:
        hour = 0
    if 0 <= hour <= 23 and 0 <= minute <= 59:
        return f"{hour:02d}:{minute:02d}"
    return None


def _extract_devices_from_text(text: str) -> list[str]:
    lowered = f" {text.lower()} "
    found: list[str] = []
    aliases = sorted(DEVICE_ALIAS.keys(), key=len, reverse=True)
    for alias in aliases:
        if alias in {"fan", "light"}:
            pattern = rf"\b{re.escape(alias)}s?\b"
        else:
            pattern = rf"\b{re.escape(alias)}\b"
        if re.search(pattern, lowered):
            canonical = DEVICE_ALIAS[alias]
            if canonical not in found:
                found.append(canonical)
    return found


def _enforce_params_from_message(tool_call: dict[str, Any], message: str) -> dict[str, Any]:
    tool = str(tool_call.get("tool") or "").strip()
    params = dict(tool_call.get("parameters") or {})
    text = message.lower()

    if tool == "toggle_appliance":
        msg_devices = _extract_devices_from_text(text)
        if any(x in text for x in ["all appliances", "all devices", "everything"]):
            params["devices"] = "all"
        elif msg_devices:
            params["devices"] = msg_devices
        if any(x in text for x in ["turn off", "switch off", "disable", "shut down"]):
            params["state"] = "off"
        if any(x in text for x in ["turn on", "switch on", "enable"]):
            params["state"] = "on"

    if tool == "schedule_appliance":
        msg_devices = _extract_devices_from_text(text)
        if msg_devices:
            params["device"] = msg_devices[0]
        if re.search(r"\b(remove|delete|cancel)\b.*\bschedule\b", text):
            params["action"] = "remove"
        msg_time = _extract_time_text(text)
        if msg_time:
            params["time"] = msg_time

    return {"tool": tool, "parameters": params}


def _ollama_general_answer(question: str, user: dict[str, Any]) -> str | None:
    try:
        current_time = simulation_state.SIMULATED_TIME or datetime.now(IST)
        tariff = get_current_tariff()["data"]
        emission = float(get_emission_factor_for_time(current_time))
        active_load = sum(float(d["units_per_hour"]) for d in get_all_appliances().values() if d["state"])
        balance = get_balance_status(user)
        bill = _latest_bill_for_user(user["user_id"])

        prompt = (
            "You are SMART METER SUPER APP assistant. "
            "Answer in concise bullet points using the context. "
            "If data is missing, explicitly say what is unavailable.\n\n"
            f"Question: {question}\n\n"
            f"Context:\n"
            f"- Current Tariff: Rs {tariff['effective_tariff']}/kWh ({tariff['type']})\n"
            f"- Active Load: {round(active_load, 3)} kWh/h\n"
            f"- Emission Factor: {round(emission, 3)} kg/kWh\n"
            f"- Meter Type: {balance.get('meter_type')}\n"
            f"- Current Balance: Rs {balance.get('current_balance')}\n"
            f"- Latest Bill Amount: Rs {bill['amount'] if bill else 0}\n"
        )
        return _ollama_generate(prompt)
    except Exception:
        return None


def _llm_fallback_answer(question: str, retrieved: list[dict[str, Any]] | None = None) -> str:
    snippets = ""
    if retrieved:
        top = retrieved[:3]
        snippets = "\n\nRetrieved snippets:\n" + "\n".join(
            [
                f"- {d.get('title') or 'Knowledge'}: {(d.get('content') or '')[:220]}"
                for d in top
            ]
        )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an intelligent energy assistant for a smart electricity management app. "
                "If the question is unrelated to energy, still respond helpfully."
            ),
        },
        {"role": "user", "content": f"{question}{snippets}"},
    ]
    return generate_ai_response(messages).strip()


def _heuristic_tool_call(message: str) -> dict[str, Any]:
    text = message.lower().strip()

    if any(x in text for x in ["thanks", "thank you", "great answer", "good answer", "nice answer"]):
        return {"tool": "knowledge_query", "parameters": {"query": message}}

    if "toggle" in text and any(x in text for x in ["device", "devices", "appliance", "appliances"]):
        return {"tool": "toggle_appliance", "parameters": {}}

    if any(x in text for x in ["how to pay", "pay electricity bill", "how can i pay", "how do i pay"]):
        return {"tool": "knowledge_query", "parameters": {"query": "How to pay electricity bill in app"}}
    if any(x in text for x in ["how to report", "report an issue", "raise issue", "raise complaint"]):
        return {"tool": "knowledge_query", "parameters": {"query": "How to raise service request in app"}}

    if any(x in text for x in ["open", "take me to", "go to", "navigate", "show page"]):
        if "solar" in text:
            return {"tool": "navigate_page", "parameters": {"page": "solar_dashboard"}}
        if "bill" in text:
            return {"tool": "navigate_page", "parameters": {"page": "billing"}}
        if "payment" in text:
            return {"tool": "navigate_page", "parameters": {"page": "payments"}}
        if "service" in text or "issue" in text:
            return {"tool": "navigate_page", "parameters": {"page": "service_requests"}}
        if "consumption" in text or "analytics" in text:
            return {"tool": "navigate_page", "parameters": {"page": "consumption_analytics"}}
        if "setting" in text:
            return {"tool": "navigate_page", "parameters": {"page": "settings"}}

    if "tariff" in text or "peak" in text or "off-peak" in text or "off peak" in text:
        return {"tool": "get_tariff_info", "parameters": {}}
    if "balance" in text or "wallet" in text:
        return {"tool": "get_balance", "parameters": {}}
    if "bill" in text:
        return {"tool": "get_bill", "parameters": {}}
    if "solar" in text:
        return {"tool": "get_solar_data", "parameters": {}}
    if ("use" in text or "usage" in text or "consumption" in text) and "today" in text:
        return {"tool": "get_consumption", "parameters": {"period": "today"}}
    if ("use" in text or "usage" in text or "consumption" in text) and "week" in text:
        return {"tool": "get_consumption", "parameters": {"period": "week"}}
    if ("use" in text or "usage" in text or "consumption" in text) and "month" in text:
        return {"tool": "get_consumption", "parameters": {"period": "month"}}
    if any(x in text for x in ["carbon footprint", "carbon", "co2", "emission"]):
        return {"tool": "get_carbon_footprint", "parameters": {}}

    if re.search(r"\b(remove|delete|cancel)\b.*\bschedule\b", text):
        msg_devices = _extract_devices_from_text(text)
        return {
            "tool": "schedule_appliance",
            "parameters": {"action": "remove", "device": msg_devices[0] if msg_devices else None},
        }

    if "schedule" in text:
        run_time = _extract_time_text(text)
        msg_devices = _extract_devices_from_text(text)
        device = "all" if "all" in text else (msg_devices[0] if msg_devices else None)
        return {"tool": "schedule_appliance", "parameters": {"device": device, "time": run_time}}

    if any(x in text for x in ["turn off", "switch off", "disable", "shut down"]):
        if any(x in text for x in ["all appliances", "all devices", "everything"]):
            return {"tool": "toggle_appliance", "parameters": {"devices": "all", "state": "off"}}
        devices: list[str] = []
        for alias in DEVICE_ALIAS.keys():
            if alias in text:
                devices.append(alias)
        return {"tool": "toggle_appliance", "parameters": {"devices": devices or "all", "state": "off"}}

    if any(x in text for x in ["turn on", "switch on", "enable"]):
        if any(x in text for x in ["all appliances", "all devices", "everything"]):
            return {"tool": "toggle_appliance", "parameters": {"devices": "all", "state": "on"}}
        devices: list[str] = []
        for alias in DEVICE_ALIAS.keys():
            if alias in text:
                devices.append(alias)
        return {"tool": "toggle_appliance", "parameters": {"devices": devices or "all", "state": "on"}}

    return {"tool": "knowledge_query", "parameters": {"query": message}}



def _deterministic_tool_call(message: str) -> dict[str, Any] | None:
    text = (message or "").lower().strip()
    if not text:
        return None

    device_keywords = ["turn", "switch", "power", "toggle", "enable", "disable", "all appliances", "everything"]
    nav_keywords = ["open", "go to", "take me", "navigate"]

    # Force executable device routing before RAG/LLM.
    if any(k in text for k in device_keywords):
        tool_call = _heuristic_tool_call(message)
        if tool_call.get("tool") in {"toggle_appliance", "schedule_appliance"}:
            return _enforce_params_from_message(tool_call, message)
        if "on" in text or "off" in text:
            return _enforce_params_from_message({"tool": "toggle_appliance", "parameters": {}}, message)

    # Force navigation routing.
    if any(k in text for k in nav_keywords):
        tool_call = _heuristic_tool_call(message)
        if tool_call.get("tool") == "navigate_page":
            return tool_call
        return {"tool": "navigate_page", "parameters": {"page": "overview"}}

    advice_keywords = [
        "reduce", "lower", "save", "saving", "cut", "decrease", "optimize", "tips",
        "what should i", "how should i", "how can i", "best way", "why is my bill high"
    ]

    # Advisory billing/consumption questions should go to knowledge flow, not raw bill lookup.
    if any(k in text for k in ["bill", "billing", "consumption", "usage", "kwh", "electricity"]) and any(a in text for a in advice_keywords):
        return {"tool": "knowledge_query", "parameters": {"query": message}}

    # Deterministic structured data routes for billing / consumption.
    billing_data_keywords = ["bill id", "bill amount", "show my bill", "current bill", "unpaid", "due date", "latest bill", "how much is my bill"]
    if any(k in text for k in ["bill", "billing", "due", "unpaid", "amount"]) and (any(k in text for k in billing_data_keywords) or "my bill" in text):
        return {"tool": "get_bill", "parameters": {}}

    if any(k in text for k in ["balance", "wallet", "recharge", "topup", "top-up"]):
        return {"tool": "get_balance", "parameters": {}}

    if any(k in text for k in ["consumption", "usage", "kwh", "energy used", "units consumed", "how much electricity", "use"]):
        period = "today"
        if "week" in text:
            period = "week"
        elif "month" in text:
            period = "month"
        return {"tool": "get_consumption", "parameters": {"period": period}}

    return None
    device_keywords = ["turn", "switch", "power", "toggle", "enable", "disable", "all appliances", "everything"]
    nav_keywords = ["open", "go to", "take me", "navigate"]

    # Force executable device routing before RAG/LLM.
    if any(k in text for k in device_keywords):
        tool_call = _heuristic_tool_call(message)
        if tool_call.get("tool") in {"toggle_appliance", "schedule_appliance"}:
            return _enforce_params_from_message(tool_call, message)
        if "on" in text or "off" in text:
            return _enforce_params_from_message({"tool": "toggle_appliance", "parameters": {}}, message)

    # Force navigation routing.
    if any(k in text for k in nav_keywords):
        tool_call = _heuristic_tool_call(message)
        if tool_call.get("tool") == "navigate_page":
            return tool_call
        return {"tool": "navigate_page", "parameters": {"page": "overview"}}

    # Deterministic structured data routes for billing / consumption.
    if any(k in text for k in ["bill", "billing", "due", "unpaid", "amount"]):
        return {"tool": "get_bill", "parameters": {}}
    if any(k in text for k in ["balance", "wallet", "recharge", "topup", "top-up"]):
        return {"tool": "get_balance", "parameters": {}}
    if any(k in text for k in ["consumption", "usage", "kwh", "energy used", "use"]):
        period = "today"
        if "week" in text:
            period = "week"
        elif "month" in text:
            period = "month"
        return {"tool": "get_consumption", "parameters": {"period": period}}

    return None
def _latest_bill_for_user(user_id: str) -> dict[str, Any] | None:
    bills = sorted(
        [b for b in store.bills.values() if b["user_id"] == user_id],
        key=lambda x: x["billing_month"],
        reverse=True,
    )
    if not bills:
        return None
    unpaid = [b for b in bills if b["status"] == "UNPAID"]
    return unpaid[0] if unpaid else bills[0]


def _resolve_devices(value: Any, session_state: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    devices = get_all_appliances()

    if value == "all":
        return list(devices.items())

    requested: list[str] = []
    if isinstance(value, str):
        requested = [value]
    elif isinstance(value, list):
        requested = [str(x) for x in value]

    if not requested:
        last_ids = session_state.get("last_device_ids", [])
        return [(did, devices[did]) for did in last_ids if did in devices]

    out: list[tuple[str, dict[str, Any]]] = []
    for token in requested:
        norm = str(token).strip().lower().replace("_", " ")
        canonical = DEVICE_ALIAS.get(norm, norm)
        for device_id, device in devices.items():
            name = device["name"].lower()
            if canonical == name or canonical in name or name in canonical:
                if all(device_id != d[0] for d in out):
                    out.append((device_id, device))
    return out


def _fmt_money(v: Any) -> str:
    return f"Rs {round(float(v or 0), 2)}"


def _execute_tool_call(tool_call: dict[str, Any], user: dict[str, Any], session_state: dict[str, Any]) -> dict[str, Any]:
    tool = str(tool_call.get("tool") or "").strip()
    params = tool_call.get("parameters") or {}

    if tool == "knowledge_query":
        q = str(params.get("query") or session_state.get("last_user_message", "")).strip()
        rag_answer, rag_source, retrieved = chat_rag_service.rag.answer(q)
        best_score = max((float(d.get("score") or 0.0) for d in retrieved), default=0.0)
        rag_confident = bool(retrieved) and best_score >= RAG_CONFIDENCE_THRESHOLD and not str(rag_source).startswith("fallback")
        if rag_confident and rag_answer.strip():
            answer = rag_answer
            path = RAG_PATH
        else:
            try:
                answer = _llm_fallback_answer(q, retrieved)
            except Exception:
                # Last safety net to avoid dead-end responses.
                answer = _ollama_general_answer(q, user) or "I can help with energy, billing, appliances, and general questions."
            path = LLM_FALLBACK_PATH
        return {
            "status": "success",
            "answer": answer,
            "source": path,
            "routing_path": path,
            "action": {"type": "knowledge_query", "ui_hints": ["overview"]},
            "retrieved": retrieved,
            "tool": tool,
            "parameters": params,
        }

    if tool == "navigate_page":
        page = PAGE_MAP.get(str(params.get("page") or "").strip().lower(), "overview")
        return {
            "status": "success",
            "answer": f"Navigating to {page.replace('_', ' ')}.",
            "source": TOOL_PATH,
            "routing_path": TOOL_PATH,
            "action": {"type": "navigate", "ui_hints": [page]},
            "navigate_to": NAV_PATH_MAP.get(page, "/app/"),
            "tool": tool,
            "parameters": {"page": page},
        }

    if tool == "toggle_appliance":
        target = str(params.get("state") or "").strip().lower()
        target_state = True if target == "on" else False if target == "off" else None
        if target_state is None:
            return {
                "status": "info",
                "answer": "Please specify state as on or off.",
                "source": TOOL_PATH,
                "routing_path": TOOL_PATH,
                "action": {"type": "toggle", "ui_hints": ["appliances"]},
                "tool": tool,
                "parameters": params,
            }

        resolved = _resolve_devices(params.get("devices"), session_state)
        if not resolved:
            return {
                "status": "info",
                "answer": "I could not identify appliances for that command.",
                "source": TOOL_PATH,
                "routing_path": TOOL_PATH,
                "action": {"type": "toggle", "ui_hints": ["appliances"]},
                "tool": tool,
                "parameters": params,
            }

        ok: list[str] = []
        blocked: list[str] = []
        for device_id, device in resolved:
            nm = device["name"].lower()
            if not target_state and nm in ALWAYS_ON:
                blocked.append(f"{device['name']} cannot be turned off (always-on)")
                continue
            update_appliance_state(device_id, target_state)
            ok.append(f"{device['name']} turned {'ON' if target_state else 'OFF'}")

        session_state["last_device_ids"] = [d[0] for d in resolved]
        lines = [f"- {x}" for x in ok] + [f"- {x}" for x in blocked]
        return {
            "status": "success" if ok else "partial",
            "answer": "\n".join(lines),
            "source": TOOL_PATH,
            "routing_path": TOOL_PATH,
            "action": {"type": "toggle", "ui_hints": ["appliances", "overview"]},
            "tool": tool,
            "parameters": params,
        }

    if tool == "get_bill":
        bill = _latest_bill_for_user(user["user_id"])
        if not bill:
            answer = "No bill found for your account."
        else:
            answer = "\n".join(
                [
                    f"- Bill ID: {bill['bill_id']}",
                    f"- Month: {bill['billing_month']}",
                    f"- Units: {bill['units_consumed']} kWh",
                    f"- Amount: {_fmt_money(bill['amount'])}",
                    f"- Status: {bill['status']}",
                ]
            )
        return {
            "status": "success",
            "answer": answer,
            "source": TOOL_PATH,
            "routing_path": TOOL_PATH,
            "action": {"type": "get_bill", "ui_hints": ["billing"]},
            "navigate_to": "/app/#billing",
            "tool": tool,
            "parameters": params,
        }

    if tool == "get_balance":
        bal = get_balance_status(user)
        answer = "\n".join(
            [
                f"- Meter Type: {bal['meter_type']}",
                f"- Current Balance: {_fmt_money(bal['current_balance'])}",
                f"- Estimated Daily Cost: {_fmt_money(bal['estimated_daily_cost'])}",
                f"- Estimated Days Remaining: {bal['estimated_days_remaining']} days",
                f"- Next Bill Estimate: {_fmt_money(bal['next_bill_estimate'])}",
            ]
        )
        return {
            "status": "success",
            "answer": answer,
            "source": TOOL_PATH,
            "routing_path": TOOL_PATH,
            "action": {"type": "get_balance", "ui_hints": ["overview"]},
            "tool": tool,
            "parameters": params,
        }

    if tool == "get_consumption":
        period = str(params.get("period") or "today").strip().lower()
        meter_id = user["smart_meter_id"]
        now = datetime.now(IST)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)

        total = 0.0
        for rec in store.consumption_records.values():
            if rec["meter_id"] != meter_id:
                continue
            ts = datetime.fromisoformat(rec["timestamp"]).astimezone(IST)
            units = float(rec["units"])
            if period == "today" and ts >= day_start:
                total += units
            elif period == "week" and ts >= week_start:
                total += units
            elif period == "month" and ts >= month_start:
                total += units

        return {
            "status": "success",
            "answer": f"- Electricity usage for {period}: {round(total, 2)} kWh",
            "source": TOOL_PATH,
            "routing_path": TOOL_PATH,
            "action": {"type": "get_consumption", "ui_hints": ["analytics", "overview"]},
            "navigate_to": "/app/#analytics",
            "tool": tool,
            "parameters": {"period": period},
        }

    if tool == "get_solar_data":
        system = next((s for s in store.solar_systems.values() if s["user_id"] == user["user_id"]), None)
        if not system:
            answer = "No solar system linked to your account."
        else:
            rows = [r for r in store.solar_generation.values() if r["system_id"] == system["system_id"]]
            total = sum(float(r["units_generated"]) for r in rows)
            answer = "\n".join(
                [
                    f"- Solar Capacity: {system['capacity_kw']} kW",
                    f"- Total Generation: {round(total, 2)} kWh",
                    f"- Estimated Savings: {_fmt_money(total * 6.0)}",
                ]
            )
        return {
            "status": "success",
            "answer": answer,
            "source": TOOL_PATH,
            "routing_path": TOOL_PATH,
            "action": {"type": "get_solar_data", "ui_hints": ["solar"]},
            "navigate_to": "/app/#solar",
            "tool": tool,
            "parameters": params,
        }

    if tool == "create_service_request":
        issue = str(params.get("issue") or "meter_fault").strip().lower()
        issue_map = {
            "meter_fault": "meter malfunction",
            "billing_issue": "billing dispute",
            "power_outage": "outage report",
            "installation_request": "installation request",
        }
        req_type = issue_map.get(issue, "meter malfunction")
        req_id = store.next_id("request")
        now_iso = datetime.now(IST).isoformat()
        store.service_requests[req_id] = {
            "request_id": req_id,
            "user_id": user["user_id"],
            "meter_id": user["smart_meter_id"],
            "request_type": req_type,
            "description": f"Created by AI agent ({issue})",
            "status": "OPEN",
            "created_at": now_iso,
            "updated_at": now_iso,
            "timeline": [{"status": "OPEN", "note": "Created by AI agent", "at": now_iso}],
        }
        return {
            "status": "success",
            "answer": f"- Service request created: {req_id}\n- Type: {req_type}\n- Status: OPEN",
            "source": TOOL_PATH,
            "routing_path": TOOL_PATH,
            "action": {"type": "create_service_request", "ui_hints": ["service"]},
            "navigate_to": "/app/#service",
            "tool": tool,
            "parameters": {"issue": issue},
        }

    if tool == "get_tariff_info":
        t = get_current_tariff()["data"]
        return {
            "status": "success",
            "answer": (
                f"- Current tariff: {_fmt_money(t['effective_tariff'])}/kWh ({t['type']})\n"
                "- Off-peak: 04:00-10:00 IST\n"
                "- Peak: 14:00-17:00 and 22:00-01:00 IST"
            ),
            "source": TOOL_PATH,
            "routing_path": TOOL_PATH,
            "action": {"type": "get_tariff_info", "ui_hints": ["overview", "analytics"]},
            "tool": tool,
            "parameters": params,
        }

    if tool == "get_carbon_footprint":
        now = simulation_state.SIMULATED_TIME or datetime.now(IST)
        factor = float(get_emission_factor_for_time(now))
        active_load = sum(float(d["units_per_hour"]) for d in get_all_appliances().values() if d["state"])
        carbon_per_hour = active_load * factor
        return {
            "status": "success",
            "answer": (
                f"- Current active load: {round(active_load, 3)} kWh/h\n"
                f"- Current emission factor: {round(factor, 3)} kg/kWh\n"
                f"- Estimated carbon footprint now: {round(carbon_per_hour, 3)} kg CO2/hour"
            ),
            "source": TOOL_PATH,
            "routing_path": TOOL_PATH,
            "action": {"type": "get_carbon_footprint", "ui_hints": ["overview", "analytics"]},
            "tool": tool,
            "parameters": params,
        }

    if tool == "schedule_appliance":
        action = str(params.get("action") or "add").strip().lower()
        device_token = params.get("device")
        run_time = str(params.get("time") or "").strip()

        if action != "remove" and not device_token and not session_state.get("last_device_ids"):
            return {
                "status": "info",
                "answer": (
                    "I can schedule devices. Tell me device and time, for example:\n"
                    '- "schedule washing machine at 04:00"\n'
                    '- "schedule AC at 6 am"'
                ),
                "source": TOOL_PATH,
                "routing_path": TOOL_PATH,
                "action": {"type": "schedule", "ui_hints": ["appliances"]},
                "tool": tool,
                "parameters": params,
            }

        resolved = _resolve_devices(device_token, session_state)
        if not resolved:
            return {
                "status": "info",
                "answer": "I could not identify the appliance to schedule.",
                "source": TOOL_PATH,
                "routing_path": TOOL_PATH,
                "action": {"type": "schedule", "ui_hints": ["appliances"]},
                "tool": tool,
                "parameters": params,
            }

        if action == "remove":
            removed = 0
            lines = []
            for device_id, device in resolved:
                count = remove_schedule(device_id=device_id, run_time=run_time or None)
                removed += count
                if count:
                    lines.append(f"- Removed {count} schedule(s) for {device['name']}")
                else:
                    lines.append(f"- No schedule found for {device['name']}")
            return {
                "status": "success",
                "answer": "\n".join(lines),
                "source": TOOL_PATH,
                "routing_path": TOOL_PATH,
                "action": {"type": "schedule_remove", "ui_hints": ["appliances"]},
                "navigate_to": "/app/#appliances",
                "tool": tool,
                "parameters": params,
            }

        if not run_time:
            return {
                "status": "info",
                "answer": 'Please provide schedule time in HH:MM format, for example: "04:00" or "6 am".',
                "source": TOOL_PATH,
                "routing_path": TOOL_PATH,
                "action": {"type": "schedule", "ui_hints": ["appliances"]},
                "tool": tool,
                "parameters": params,
            }

        lines = []
        for device_id, device in resolved:
            add_schedule(device_id, run_time)
            lines.append(f"- {device['name']} scheduled at {run_time} IST")
        session_state["last_device_ids"] = [d[0] for d in resolved]

        return {
            "status": "success",
            "answer": "\n".join(lines),
            "source": TOOL_PATH,
            "routing_path": TOOL_PATH,
            "action": {"type": "schedule", "ui_hints": ["appliances"]},
            "navigate_to": "/app/#appliances",
            "tool": tool,
            "parameters": params,
        }

    return {
        "status": "info",
        "answer": "I could not map that command to a known tool. Falling back to knowledge assistant.",
        "source": TOOL_PATH,
        "routing_path": TOOL_PATH,
        "action": {"type": "unknown", "ui_hints": ["overview"]},
        "tool": tool,
        "parameters": params,
    }


class ToolAgentService:
    def _session_key(self, user_id: str, session_id: str | None) -> str:
        return f"{user_id}:{session_id or 'default'}"

    def query(self, user: dict[str, Any], message: str, session_id: str | None) -> dict[str, Any]:
        session_key = self._session_key(user["user_id"], session_id)
        history = store.chat_sessions.setdefault(session_key, [])
        session_state = store.chat_agent_state.setdefault(session_key, {})
        session_state["last_user_message"] = message

        retrieved: list[dict[str, Any]] = []
        try:
            tool_call = _deterministic_tool_call(message)
            if tool_call is None:
                tool_call = interpret_command(message)
                tool_call = _enforce_params_from_message(tool_call, message)
                if not tool_call.get("tool"):
                    tool_call = _heuristic_tool_call(message)
            result = _execute_tool_call(tool_call, user, session_state)

            if tool_call.get("tool") == "knowledge_query":
                retrieved = result.get("retrieved") or []

            answer = result["answer"]
            path_label = result.get("routing_path") or TOOL_PATH
            source = path_label
            action = result.get("action")
            navigate_to = result.get("navigate_to")
            tool = tool_call.get("tool")
            params = tool_call.get("parameters")
        except Exception as exc:
            tool_call = _deterministic_tool_call(message)
            if tool_call is None:
                tool_call = _enforce_params_from_message(_heuristic_tool_call(message), message)
            try:
                result = _execute_tool_call(tool_call, user, session_state)
                answer = result["answer"]
                path_label = result.get("routing_path") or TOOL_PATH
                source = path_label
                action = result.get("action")
                navigate_to = result.get("navigate_to")
                tool = tool_call.get("tool")
                params = tool_call.get("parameters")
            except Exception as exc2:
                rag_answer, rag_source, retrieved = chat_rag_service.rag.answer(message)
                best_score = max((float(d.get("score") or 0.0) for d in retrieved), default=0.0)
                if retrieved and best_score >= RAG_CONFIDENCE_THRESHOLD and not str(rag_source).startswith("fallback"):
                    answer = rag_answer
                    source = RAG_PATH
                else:
                    try:
                        answer = _llm_fallback_answer(message, retrieved)
                    except Exception:
                        answer = _ollama_general_answer(message, user) or "I can help with energy, billing, appliances, and general questions."
                    source = LLM_FALLBACK_PATH
                action = {"type": "knowledge_query", "ui_hints": ["overview"]}
                navigate_to = None
                tool = "knowledge_query"
                params = {"query": message}
                path_label = source

        logger.info("Chat route selected: %s", path_label)

        now_iso = datetime.now(IST).isoformat()
        history.append({"role": "user", "text": message, "at": now_iso})
        history.append({"role": "assistant", "text": answer, "at": now_iso})
        if len(history) > 40:
            del history[:-40]

        store.chat_query_logs.append(
            {
                "timestamp": now_iso,
                "user_id": user["user_id"],
                "session_key": session_key,
                "query": message,
                "tool": tool,
                "parameters": params,
                "response": answer,
                "source": source,
            }
        )
        if len(store.chat_query_logs) > 1000:
            store.chat_query_logs = store.chat_query_logs[-1000:]

        return {
            "status": "success",
            "session_id": session_id or "default",
            "intent": tool,
            "answer": answer,
            "source": source,
            "action": action,
            "navigate_to": navigate_to,
            "tool": tool,
            "parameters": params,
            "retrieved": [
                {
                    "title": d.get("title"),
                    "score": d.get("score"),
                    "domain": d.get("meta", {}).get("domain") if isinstance(d.get("meta"), dict) else d.get("domain"),
                }
                for d in retrieved
            ],
            "history": history[-10:],
        }


tool_agent_service = ToolAgentService()



