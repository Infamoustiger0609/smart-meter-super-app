from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
import difflib
import json
import math
import re
from typing import Any
from zoneinfo import ZoneInfo

from backend import simulation_state
from backend.appliances import get_all_appliances, get_total_active_load, update_appliance_state
from backend.ai_engine import generate_ai_response
from backend.cost import get_billing_estimate, get_current_cost
from backend.database.memory_store import store
from backend.scheduler import add_schedule
from backend.services.energy_balance import get_balance_forecast, get_balance_status, recompute_wallet, topup_balance
from backend.tariff import get_current_tariff, get_emission_factor_for_time

IST = ZoneInfo("Asia/Kolkata")
CONTROLLED_FALLBACK = "I can help with energy, billing, appliances, and general questions."

INTENT_KEYWORDS = {
    "device_control": ["turn on", "turn off", "switch on", "switch off", "schedule", "set", "appliance"],
    "energy_query": ["usage", "consume", "consumption", "kwh", "today", "week", "energy used"],
    "billing_query": ["bill", "billing", "due", "unpaid", "amount", "estimate", "pay", "payment", "transaction"],
    "balance_query": ["balance", "wallet", "recharge", "topup", "top-up", "days remaining", "how long will", "next bill"],
    "carbon_query": ["carbon", "co2", "emission", "footprint"],
    "tariff_query": ["tariff", "peak", "off peak", "off-peak", "surcharge", "rebate", "rate"],
    "service_request": ["service", "complaint", "issue", "report", "ticket", "malfunction", "outage", "dispute"],
    "system_navigation": ["where", "navigate", "open", "go to", "which page", "find"],
}

INTENT_DOMAINS = {
    "general_knowledge": {"faq", "knowledge", "tips", "appliance_knowledge", "tariff_knowledge"},
    "device_control": set(),
    "energy_query": set(),
    "billing_query": set(),
    "balance_query": set(),
    "carbon_query": set(),
    "tariff_query": set(),
    "service_request": set(),
    "system_navigation": set(),
}


class IntentRouter:
    def classify(self, message: str) -> str:
        text = message.lower().strip()
        if re.search(r"\b(turn|switch|enable|disable|start|stop)\b", text) and re.search(r"\b(on|off)\b", text):
            return "device_control"
        if re.search(r"\b(turn|switch)\b.*\b(them|those|it|everything|all)\b", text):
            return "device_control"
        if re.search(r"\b(turn|switch|enable|disable)\b", text) and (
            "appliance" in text or "device" in text or "load" in text
        ):
            return "device_control"

        for intent, keywords in INTENT_KEYWORDS.items():
            if any(k in text for k in keywords):
                return intent

        return "general_knowledge"


class LocalVectorStore:
    def __init__(self) -> None:
        self._docs: list[dict[str, Any]] = []

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        return re.findall(r"[a-zA-Z0-9_]+", text.lower())

    def set_documents(self, docs: list[dict[str, Any]]) -> None:
        self._docs = []
        for doc in docs:
            counts = Counter(self._tokenize(doc["content"]))
            norm = math.sqrt(sum(v * v for v in counts.values())) or 1.0
            self._docs.append(
                {
                    "id": doc.get("id") or f"doc_{len(self._docs) + 1}",
                    "title": doc.get("title", "Knowledge"),
                    "content": doc["content"],
                    "meta": doc.get("meta", {}),
                    "counts": counts,
                    "norm": norm,
                }
            )

    def search(self, query: str, *, top_k: int = 3, threshold: float = 0.65, domains: set[str] | None = None) -> list[dict[str, Any]]:
        q_counts = Counter(self._tokenize(query))
        q_norm = math.sqrt(sum(v * v for v in q_counts.values())) or 1.0
        if not q_counts:
            return []

        scored: list[tuple[float, dict[str, Any]]] = []
        for doc in self._docs:
            if domains and doc["meta"].get("domain") not in domains:
                continue

            dot = sum(qv * doc["counts"].get(token, 0) for token, qv in q_counts.items())
            score = dot / (q_norm * doc["norm"])
            if score >= threshold:
                scored.append((score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {
                "id": d["id"],
                "title": d["title"],
                "content": d["content"],
                "meta": d["meta"],
                "score": round(s, 5),
            }
            for s, d in scored[:top_k]
        ]


class DeviceCommandParser:
    ALWAYS_ON_NAMES = {"refrigerator"}

    def __init__(self) -> None:
        self.aliases = {
            "ac": "air conditioner",
            "air conditioner": "air conditioner",
            "refrigerator": "refrigerator",
            "fridge": "refrigerator",
            "fan": "ceiling fan",
            "fans": "ceiling fan",
            "light": "led lights",
            "lights": "led lights",
            "tube light": "tube lights",
            "washing machine": "washing machine",
            "geyser": "geyser",
            "router": "wi-fi router",
            "water pump": "water pump",
            "induction": "induction cooktop",
            "microwave": "microwave oven",
            "charger": "mobile chargers",
            "tv": "smart tv",
            "cooler": "air cooler",
            "everything": "__ALL__",
            "all devices": "__ALL__",
            "all device": "__ALL__",
            "all appliances": "__ALL__",
            "all appliance": "__ALL__",
            "all applicances": "__ALL__",
            "all appliences": "__ALL__",
            "all devicee": "__ALL__",
            "all loads": "__ALL__",
            "all gadgets": "__ALL__",
            "cooling unit": "air conditioner",
            "lamp": "led lights",
            "lamps": "led lights",
            "bulb": "led lights",
            "bulbs": "led lights",
        }
        self.group_tokens = {
            "all devices",
            "all device",
            "all appliances",
            "all appliance",
            "all the devices",
            "all the device",
            "all the appliances",
            "all the appliance",
            "all of the devices",
            "all of the appliances",
            "everything",
            "all loads",
            "all gadgets",
            "all applicances",
            "all appliences",
            "all devicee",
        }
        self.spelling_normalize = {
            "applicances": "appliances",
            "appliences": "appliances",
            "appliancee": "appliance",
            "devicee": "device",
            "ligths": "lights",
            "refridgerator": "refrigerator",
        }
        self.group_nouns = {"device", "devices", "appliance", "appliances", "load", "loads", "gadget", "gadgets"}

    def _normalize(self, text: str) -> str:
        out = text.lower().strip()
        for bad, good in self.spelling_normalize.items():
            out = re.sub(rf"\b{re.escape(bad)}\b", good, out)
        # Normalize common natural phrasing variants.
        out = re.sub(r"\ball\s+of\s+the\s+", "all ", out)
        out = re.sub(r"\ball\s+the\s+", "all ", out)
        out = re.sub(r"\s+", " ", out)
        return out

    def _fuzzy_alias_matches(self, text: str) -> set[str]:
        words = re.findall(r"[a-zA-Z0-9_]+", text.lower())
        found: set[str] = set()
        for w in words:
            candidates = difflib.get_close_matches(w, list(self.aliases.keys()), n=2, cutoff=0.84)
            for cand in candidates:
                canonical = self.aliases.get(cand)
                if canonical and canonical != "__ALL__":
                    found.add(canonical)
        return found

    def _is_group_command(self, text: str) -> bool:
        if any(tok in text for tok in self.group_tokens):
            return True
        if re.search(r"\b(turn|switch|disable|enable|start|stop)\b.*\beverything\b", text):
            return True
        if re.search(r"\ball\b(?:\s+\w+){0,2}\s+\b(devices?|appliances?|loads?|gadgets?)\b", text):
            return True

        words = re.findall(r"[a-zA-Z0-9_]+", text)
        has_all = "all" in words or "everything" in words or "every" in words
        if not has_all:
            return False
        for w in words:
            if w in self.group_nouns:
                return True
            if difflib.get_close_matches(w, list(self.group_nouns), n=1, cutoff=0.8):
                return True
        return False

    def parse(self, message: str) -> dict[str, Any]:
        text = self._normalize(message)
        target_state = None
        if any(k in text for k in ["turn on", "switch on", "enable", "start"]):
            target_state = True
        if any(k in text for k in ["turn off", "switch off", "disable", "stop"]):
            target_state = False
        if re.search(r"\b(turn|switch)\b(?:\s+\w+){0,3}\s+\bon\b", text):
            target_state = True
        if re.search(r"\b(turn|switch)\b(?:\s+\w+){0,3}\s+\boff\b", text):
            target_state = False

        schedule_time = self._extract_time(text)
        is_schedule = "schedule" in text and schedule_time is not None

        devices = get_all_appliances()
        requested: list[tuple[str, dict[str, Any]]] = []
        is_all_group = self._is_group_command(text)

        if "all fans" in text:
            requested.extend([(k, v) for k, v in devices.items() if "fan" in v["name"].lower()])
        if "all lights" in text:
            requested.extend([(k, v) for k, v in devices.items() if "light" in v["name"].lower()])
        if is_all_group:
            requested.extend(list(devices.items()))

        for alias, canonical in self.aliases.items():
            if alias in text:
                if canonical == "__ALL__":
                    requested.extend(list(devices.items()))
                    continue
                for device_id, device in devices.items():
                    if canonical == device["name"].lower():
                        requested.append((device_id, device))

        fuzzy_canonical = self._fuzzy_alias_matches(text)
        for canonical in fuzzy_canonical:
            for device_id, device in devices.items():
                if canonical == device["name"].lower():
                    requested.append((device_id, device))

        seen = set()
        unique_requested = []
        for device_id, device in requested:
            if device_id not in seen:
                seen.add(device_id)
                unique_requested.append((device_id, device))

        return {
            "target_state": target_state,
            "is_schedule": is_schedule,
            "schedule_time": schedule_time,
            "devices": unique_requested,
            "is_all_group": is_all_group,
        }

    def _extract_time(self, text: str) -> str | None:
        m = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", text)
        if not m:
            return None
        hour = int(m.group(1))
        minute = int(m.group(2) or 0)
        suffix = m.group(3)
        if suffix == "pm" and hour < 12:
            hour += 12
        if suffix == "am" and hour == 12:
            hour = 0
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return f"{hour:02d}:{minute:02d}"
        return None


class RAGResponder:
    def __init__(self) -> None:
        self.store = LocalVectorStore()
        self.base_docs = self._knowledge_docs()

    def _knowledge_docs(self) -> list[dict[str, Any]]:
        docs = [
            {
                "id": "k_tariff",
                "title": "Tariff Knowledge",
                "content": "Off-peak tariff hours are 04:00-10:00 IST with rebate. Peak windows are 14:00-17:00 and 22:00-01:00 IST with surcharge.",
                "meta": {"domain": "tariff_knowledge"},
            },
            {
                "id": "k_saving",
                "title": "Energy Saving Tips",
                "content": "Shift flexible heavy appliances to off-peak hours, avoid overlap of AC/geyser/induction in peak windows, and review hourly spikes in analytics.",
                "meta": {"domain": "tips"},
            },
            {
                "id": "k_appliances",
                "title": "Appliance Consumption",
                "content": "AC, geyser, induction cooktop and water pump are high load appliances. Router, LED and chargers are low load devices.",
                "meta": {"domain": "appliance_knowledge"},
            },
            {
                "id": "k_service",
                "title": "Service Request Guide",
                "content": "Use Service Requests page to create meter malfunction, billing dispute, outage report, or installation requests and track status timeline.",
                "meta": {"domain": "knowledge"},
            },
        ]
        for faq in store.help_faqs:
            docs.append(
                {
                    "id": f"faq_{faq['id']}",
                    "title": faq["question"],
                    "content": faq["answer"],
                    "meta": {"domain": "faq"},
                }
            )
        return docs

    def answer(self, message: str) -> tuple[str, str, list[dict[str, Any]]]:
        self.store.set_documents(self.base_docs)
        retrieved = self.store.search(message, top_k=3, threshold=0.65, domains=INTENT_DOMAINS["general_knowledge"])

        if not retrieved:
            try:
                txt = generate_ai_response(
                    [
                        {
                            "role": "system",
                            "content": (
                                "You are an intelligent energy assistant for a smart electricity management app. "
                                "If the question is unrelated to energy, still respond helpfully."
                            ),
                        },
                        {"role": "user", "content": message},
                    ]
                ).strip()
                return (txt or CONTROLLED_FALLBACK), "llm_fallback_no_relevant_docs", []
            except Exception:
                return CONTROLLED_FALLBACK, "fallback_no_relevant_docs", []

        prompt = f"""
You are a precise electricity support assistant.
Answer only the user's question.
Use only this retrieved context.
Do not mix unrelated topics.
Keep response concise.

Context:
{chr(10).join([f"- {d['title']}: {d['content']}" for d in retrieved])}

Question:
{message}
"""

        try:
            txt = generate_ai_response([{"role": "user", "content": prompt}]).strip()
            if not txt:
                return CONTROLLED_FALLBACK, "fallback_empty_llm", retrieved
            return txt, "ai_engine", retrieved
        except Exception as exc:
            return (
                retrieved[0]["content"],
                f"fallback_llm_unavailable ({type(exc).__name__})",
                retrieved,
            )


class ActionExecutor:
    def __init__(self) -> None:
        self.device_parser = DeviceCommandParser()

    def run(self, *, intent: str, user: dict[str, Any], message: str, session_state: dict[str, Any]) -> dict[str, Any] | None:
        if intent == "device_control":
            return self._device_control(user, message, session_state)
        if intent == "balance_query":
            return self._balance_query(user, message)
        if intent == "billing_query":
            if any(k in message.lower() for k in ["balance", "recharge", "topup", "top-up", "how long will", "next bill"]):
                return self._balance_query(user, message)
            if self._is_payment_action(message):
                return self._payment_action(user, message)
            if self._is_payment_instruction(message):
                return self._payment_instructions(user)
            return self._billing_query(user)
        if intent == "energy_query":
            return self._energy_query(user)
        if intent == "carbon_query":
            return self._carbon_query()
        if intent == "tariff_query":
            return self._tariff_query()
        if intent == "service_request":
            return self._service_request(user, message)
        if intent == "system_navigation":
            return self._system_navigation(message)
        return None

    def _is_payment_instruction(self, message: str) -> bool:
        text = message.lower()
        return any(
            phrase in text
            for phrase in [
                "how to pay",
                "how can i pay",
                "how do i pay",
                "where to pay",
                "payment steps",
                "pay electricity bill",
            ]
        )

    def _is_payment_action(self, message: str) -> bool:
        text = message.lower()
        if not any(token in text for token in ["pay", "payment"]):
            return False
        return any(
            phrase in text
            for phrase in [
                "pay now",
                "pay my bill now",
                "make payment",
                "do payment",
                "confirm payment",
                "proceed payment",
            ]
        )

    def _device_control(self, user: dict[str, Any], message: str, session_state: dict[str, Any]) -> dict[str, Any]:
        parsed = self.device_parser.parse(message)
        devices = parsed["devices"]

        if not devices:
            if parsed.get("is_all_group"):
                devices = list(get_all_appliances().items())
            else:
                fallback_all = self.device_parser._is_group_command(self.device_parser._normalize(message))
                if fallback_all:
                    devices = list(get_all_appliances().items())
        if not devices:
            text = message.lower()
            refers_previous = any(p in text for p in ["them", "those", "it", "same devices", "same ones"])
            if refers_previous:
                last_action = session_state.get("last_action", {})
                last_ids = last_action.get("device_ids", [])
                all_devices = get_all_appliances()
                devices = [(dev_id, all_devices[dev_id]) for dev_id in last_ids if dev_id in all_devices]

        if not devices:
            return {
                "status": "info",
                "message": "I could not identify the appliance name in your command.",
                "parsed_devices": [],
                "ui_hints": ["appliances"],
            }

        results = []
        if parsed["is_schedule"]:
            run_time = parsed["schedule_time"]
            for device_id, device in devices:
                add_schedule(device_id, run_time)
                results.append(f"{device['name']} scheduled for {run_time} IST")

            session_state["last_action"] = {
                "type": "schedule",
                "devices": [d[1]["name"] for d in devices],
                "device_ids": [d[0] for d in devices],
                "run_time": run_time,
                "failed": [],
            }
            return {
                "status": "success",
                "message": "\n".join([f"- {r}" for r in results]),
                "parsed_devices": [d[1]["name"] for d in devices],
                "ui_hints": ["appliances", "overview"],
            }

        if parsed["target_state"] is None:
            return {
                "status": "info",
                "message": "Please specify whether to turn appliance ON or OFF.",
                "parsed_devices": [d[1]["name"] for d in devices],
                "ui_hints": ["appliances"],
            }

        failed = []
        for device_id, device in devices:
            name_l = device["name"].lower()
            if not parsed["target_state"] and name_l in DeviceCommandParser.ALWAYS_ON_NAMES:
                failed.append(
                    f"{device['name']} cannot be turned off because it is configured as an always-on appliance"
                )
                continue
            update_appliance_state(device_id, parsed["target_state"])
            results.append(f"{device['name']} turned {'ON' if parsed['target_state'] else 'OFF'}")

        session_state["last_action"] = {
            "type": "toggle",
            "requested_state": parsed["target_state"],
            "devices": [d[1]["name"] for d in devices],
            "device_ids": [d[0] for d in devices],
            "failed": failed,
        }

        text_lower = message.lower()
        used_group_cmd = parsed.get("is_all_group") or any(
            x in text_lower for x in ["everything", "all devices", "all appliance", "all appliances", "all loads"]
        )

        if used_group_cmd and results:
            summary = (
                f"- All controllable appliances turned {'ON' if parsed['target_state'] else 'OFF'}: "
                + ", ".join([r.rsplit(" turned ", 1)[0] for r in results])
            )
            lines = [summary]
        else:
            lines = []

        if not used_group_cmd:
            lines.extend([f"- {x}" for x in results])
        lines.extend([f"- {x}" for x in failed])

        return {
            "status": "success" if results else "partial",
            "message": "\n".join(lines),
            "parsed_devices": [d[1]["name"] for d in devices],
            "ui_hints": ["appliances", "overview"],
        }

    def _billing_query(self, user: dict[str, Any]) -> dict[str, Any]:
        user_bills = sorted(
            [b for b in store.bills.values() if b["user_id"] == user["user_id"]],
            key=lambda x: x["billing_month"],
            reverse=True,
        )
        if not user_bills:
            return {
                "status": "info",
                "message": "No billing records are available yet for your account.",
                "ui_hints": ["billing"],
            }
        latest = user_bills[0]
        unpaid = [b for b in user_bills if b["status"] == "UNPAID"]
        msg = [
            f"- Current bill ({latest['billing_month']}): Rs {latest['amount']} for {latest['units_consumed']} kWh",
            f"- Status: {latest['status']}",
            f"- Unpaid bills: {len(unpaid)}",
            f"- Next due date: {latest['due_date']}",
        ]
        return {"status": "success", "message": "\n".join(msg), "ui_hints": ["billing"]}

    def _payment_instructions(self, user: dict[str, Any]) -> dict[str, Any]:
        bills = [b for b in store.bills.values() if b["user_id"] == user["user_id"] and b["status"] == "UNPAID"]
        if bills:
            bills.sort(key=lambda x: x["billing_month"], reverse=True)
            target = bills[0]
            due_line = f"Current unpaid bill: {target['bill_id']} (Rs {target['amount']}, due {target['due_date']})."
        else:
            due_line = "No unpaid bill is currently listed for your account."
        return {
            "status": "success",
            "message": (
                f"- {due_line}\n"
                "- Open Billing page from left navigation.\n"
                "- Click Pay on the target bill or go to Payments page.\n"
                "- Choose UPI, CARD, or NET_BANKING and submit.\n"
                '- To let me execute payment, type: "pay my bill now".'
            ),
            "ui_hints": ["billing", "payments"],
        }

    def _payment_action(self, user: dict[str, Any], message: str) -> dict[str, Any]:
        bills = [b for b in store.bills.values() if b["user_id"] == user["user_id"] and b["status"] == "UNPAID"]
        if not bills:
            return {"status": "info", "message": "No unpaid bill found.", "ui_hints": ["billing", "payments"]}
        target = bills[0]
        method = "UPI"
        text = message.lower()
        if "card" in text:
            method = "CARD"
        elif "net" in text:
            method = "NET_BANKING"

        target["status"] = "PAID"
        pay_id = store.next_id("payment")
        txn = f"TXN-{int(datetime.now(IST).timestamp())}-{pay_id}"
        store.payments[pay_id] = {
            "payment_id": pay_id,
            "bill_id": target["bill_id"],
            "user_id": user["user_id"],
            "amount": float(target["amount"]),
            "payment_method": method,
            "transaction_id": txn,
            "payment_status": "SUCCESS",
            "payment_date": datetime.now(IST).isoformat(),
        }
        recompute_wallet(user)

        return {
            "status": "success",
            "message": f"- Payment successful for {target['bill_id']}\n- Method: {method}\n- Transaction: {txn}",
            "ui_hints": ["payments", "billing", "overview"],
        }

    def _balance_query(self, user: dict[str, Any], message: str) -> dict[str, Any]:
        text = message.lower()
        if any(k in text for k in ["recharge now", "topup now", "top-up now"]):
            amount = self._extract_currency_amount(message) or 500.0
            wallet = topup_balance(user, amount, "UPI")
            return {
                "status": "success",
                "message": (
                    f"- Recharge successful: Rs {round(amount, 2)}\n"
                    f"- New balance: Rs {round(float(wallet['current_balance']), 2)}\n"
                    f"- Estimated daily cost: Rs {round(float(wallet['estimated_daily_cost']), 2)}"
                ),
                "ui_hints": ["overview", "billing", "payments"],
            }

        forecast_amount = self._extract_currency_amount(message) if any(x in text for x in ["with", "for", "rs", "inr", "₹"]) else None
        forecast = get_balance_forecast(user, forecast_amount)
        status = get_balance_status(user)

        if status["meter_type"] == "PREPAID":
            msg_lines = [
                f"- Current balance: Rs {status['current_balance']}",
                f"- Average daily spending (last 7 days): Rs {status['estimated_daily_cost']}",
                f"- Estimated days remaining: {status['estimated_days_remaining']} days",
                f"- Predicted zero-balance date: {forecast['predicted_zero_date']}",
                f"- Next bill estimate: Rs {status['next_bill_estimate']}",
            ]
            if forecast_amount:
                msg_lines.append(f"- With Rs {round(float(forecast_amount), 2)}, balance can last about {forecast['projected_days_with_amount']} days")
            else:
                msg_lines.append(f"- Recommended recharge amount: Rs {forecast['recommended_recharge_amount']}")
        else:
            msg_lines = [
                "- Meter type: POSTPAID",
                f"- Outstanding amount: Rs {status['outstanding_amount']}",
                f"- Estimated daily spending (last 7 days): Rs {status['estimated_daily_cost']}",
                f"- Next bill projection: Rs {status['next_bill_estimate']}",
                f"- Suggested payment window: before {forecast['predicted_zero_date']}",
            ]

        return {"status": "success", "message": "\n".join(msg_lines), "ui_hints": ["overview", "billing", "payments"]}

    def _extract_currency_amount(self, message: str) -> float | None:
        m = re.search(r"(?:₹|rs\.?|inr)?\s*(\d{2,6}(?:\.\d{1,2})?)", message.lower())
        if not m:
            return None
        try:
            return float(m.group(1))
        except ValueError:
            return None

    def _energy_query(self, user: dict[str, Any]) -> dict[str, Any]:
        meter_id = user["smart_meter_id"]
        now = datetime.now(IST)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)

        today = 0.0
        week = 0.0
        for rec in store.consumption_records.values():
            if rec["meter_id"] != meter_id:
                continue
            ts = datetime.fromisoformat(rec["timestamp"]).astimezone(IST)
            units = float(rec["units"])
            if ts >= day_start:
                today += units
            if ts >= week_start:
                week += units

        return {
            "status": "success",
            "message": f"- Today consumption: {round(today, 2)} kWh\n- Last 7 days: {round(week, 2)} kWh\n- Live load: {round(get_total_active_load(), 2)} kWh/h",
            "ui_hints": ["analytics", "overview"],
        }

    def _carbon_query(self) -> dict[str, Any]:
        now = simulation_state.SIMULATED_TIME or datetime.now(IST)
        emission_factor = get_emission_factor_for_time(now)
        load = get_total_active_load()
        carbon_per_hour = load * emission_factor
        return {
            "status": "success",
            "message": f"- Current carbon intensity factor: {round(emission_factor, 3)} kg/kWh\n- Estimated current emissions: {round(carbon_per_hour, 3)} kg CO2/hour",
            "ui_hints": ["overview", "analytics"],
        }

    def _tariff_query(self) -> dict[str, Any]:
        tariff = get_current_tariff()["data"]
        return {
            "status": "success",
            "message": (
                f"- Current tariff: Rs {tariff['effective_tariff']}/kWh ({tariff['type']})\n"
                "- Off-peak: 04:00-10:00 IST\n"
                "- Peak: 14:00-17:00 and 22:00-01:00 IST"
            ),
            "ui_hints": ["overview", "analytics"],
        }

    def _service_request(self, user: dict[str, Any], message: str) -> dict[str, Any]:
        text = message.lower()
        create = any(k in text for k in ["raise", "create", "report", "new", "submit"])
        if not create:
            recent = sorted(
                [r for r in store.service_requests.values() if r["user_id"] == user["user_id"]],
                key=lambda x: x["updated_at"],
                reverse=True,
            )
            if not recent:
                return {"status": "info", "message": "No service request found yet.", "ui_hints": ["service"]}
            r = recent[0]
            return {
                "status": "success",
                "message": f"- Latest request: {r['request_id']} ({r['request_type']})\n- Status: {r['status']}\n- Updated: {r['updated_at']}",
                "ui_hints": ["service"],
            }

        req_type = "meter malfunction"
        if "billing" in text:
            req_type = "billing dispute"
        elif "outage" in text:
            req_type = "outage report"
        elif "install" in text:
            req_type = "installation request"

        req_id = store.next_id("request")
        now_iso = datetime.now(IST).isoformat()
        store.service_requests[req_id] = {
            "request_id": req_id,
            "user_id": user["user_id"],
            "meter_id": user["smart_meter_id"],
            "request_type": req_type,
            "description": message[:260],
            "status": "OPEN",
            "created_at": now_iso,
            "updated_at": now_iso,
            "timeline": [{"status": "OPEN", "note": "Request created via chatbot", "at": now_iso}],
        }
        return {
            "status": "success",
            "message": f"- Service request created: {req_id}\n- Type: {req_type}\n- Status: OPEN",
            "ui_hints": ["service"],
        }

    def _system_navigation(self, message: str) -> dict[str, Any]:
        text = message.lower()
        page = "overview"
        if "bill" in text:
            page = "billing"
        elif "payment" in text:
            page = "payments"
        elif "service" in text or "complaint" in text:
            page = "service"
        elif "solar" in text:
            page = "solar"
        elif "appliance" in text:
            page = "appliances"
        elif "consumption" in text or "analytics" in text:
            page = "analytics"
        elif "calculator" in text:
            page = "calculator"
        elif "help" in text:
            page = "help"
        elif "settings" in text:
            page = "settings"

        return {
            "status": "success",
            "message": f"Open the {page.title()} page from the left navigation menu.",
            "ui_hints": [page],
        }


class ChatAgentService:
    def __init__(self) -> None:
        self.intent_router = IntentRouter()
        self.executor = ActionExecutor()
        self.rag = RAGResponder()

    def _llm_finalize(
        self,
        *,
        intent: str,
        user_message: str,
        base_answer: str,
        action: dict[str, Any] | None,
    ) -> tuple[str, str]:
        prompt = f"""
You are IntelliSmart assistant.
Rewrite the assistant response for clarity and natural tone.

Rules:
- Keep facts exactly the same as provided.
- Do not invent numbers, devices, or actions.
- Keep concise (max 120 words).
- If action confirmation exists, keep it explicit per device.
- Prefer bullet points for operational confirmations.

Intent: {intent}
User query: {user_message}
Action result JSON: {json.dumps(action, ensure_ascii=True) if action else "null"}
Base response:
{base_answer}
"""
        try:
            text = generate_ai_response([{"role": "user", "content": prompt}]).strip()
            if text:
                return text, "ai_engine_finalized"
            return base_answer, "fallback_empty_finalizer"
        except Exception as exc:
            return base_answer, f"fallback_finalizer_unavailable ({type(exc).__name__})"

    def _session_key(self, user_id: str, session_id: str | None) -> str:
        return f"{user_id}:{session_id or 'default'}"

    def _followup_explanation(self, message: str, state: dict[str, Any]) -> str | None:
        text = message.lower()
        if "why" in text and "not turn off" in text:
            last_action = state.get("last_action", {})
            failed = last_action.get("failed", [])
            if failed:
                return "\n".join([f"- {f}" for f in failed])
        return None

    def query(self, user: dict[str, Any], message: str, session_id: str | None) -> dict[str, Any]:
        session_key = self._session_key(user["user_id"], session_id)
        history = store.chat_sessions.setdefault(session_key, [])
        session_state = store.chat_agent_state.setdefault(session_key, {})

        followup = self._followup_explanation(message, session_state)
        if followup:
            base_answer = followup
            intent = "device_control"
            source = "conversation_state"
            action = None
            retrieved = []
        else:
            intent = self.intent_router.classify(message)
            action = self.executor.run(intent=intent, user=user, message=message, session_state=session_state)

            if action is not None:
                base_answer = action["message"]
                source = "action_executor"
                retrieved = []
            else:
                # Only knowledge intent routes to RAG.
                rag_answer, source, retrieved = self.rag.answer(message)
                base_answer = rag_answer

        answer, finalize_source = self._llm_finalize(
            intent=intent,
            user_message=message,
            base_answer=base_answer,
            action=action,
        )
        source = f"{source} -> {finalize_source}"

        history.append({"role": "user", "text": message, "at": datetime.now(IST).isoformat()})
        history.append({"role": "assistant", "text": answer, "at": datetime.now(IST).isoformat()})
        if len(history) > 40:
            del history[:-40]

        log_item = {
            "timestamp": datetime.now(IST).isoformat(),
            "user_id": user["user_id"],
            "session_key": session_key,
            "query": message,
            "intent": intent,
            "parsed_devices": action.get("parsed_devices") if action else [],
            "executed_tool": "action_executor" if action else "rag",
            "response": answer,
            "source": source,
            "retrieved": [
                {
                    "id": d["id"],
                    "title": d["title"],
                    "score": d["score"],
                    "domain": d["meta"].get("domain"),
                }
                for d in retrieved
            ],
        }
        store.chat_query_logs.append(log_item)
        if len(store.chat_query_logs) > 1000:
            store.chat_query_logs = store.chat_query_logs[-1000:]

        return {
            "status": "success",
            "session_id": session_id or "default",
            "intent": intent,
            "answer": answer,
            "source": source,
            "action": action,
            "retrieved": [
                {
                    "title": d["title"],
                    "score": d["score"],
                    "domain": d["meta"].get("domain"),
                }
                for d in retrieved
            ],
            "history": history[-10:],
        }


chat_rag_service = ChatAgentService()

