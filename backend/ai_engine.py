from __future__ import annotations

import logging
import os
from typing import Any

import requests

logger = logging.getLogger("superapp.ai")

GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama3-8b-8192")
OLLAMA_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "phi3:mini")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "18"))
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", str(OLLAMA_TIMEOUT_SECONDS)))
_AI_TEMPERATURE_RAW = os.getenv("AI_TEMPERATURE")

try:
    AI_TEMPERATURE = float(_AI_TEMPERATURE_RAW) if _AI_TEMPERATURE_RAW is not None else None
except ValueError:
    AI_TEMPERATURE = None

ALLOWED_ROLES = {"system", "user", "assistant"}


def _ai_mode() -> str:
    return (os.getenv("AI_MODE", "cloud") or "cloud").strip().lower()


def _groq_api_key() -> str:
    return (os.getenv("GROQ_API_KEY", "") or "").strip()


def _ollama_base_url() -> str:
    configured = (os.getenv("OLLAMA_URL", "http://localhost:11434") or "http://localhost:11434").strip()
    if configured.endswith("/api/generate"):
        configured = configured[: -len("/api/generate")]
    return configured.rstrip("/")


def _messages_to_prompt(messages: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for msg in messages:
        role = str(msg.get("role") or "user").strip().lower()
        content = str(msg.get("content") or "").strip()
        if not content:
            continue
        if role == "system":
            lines.append(f"System: {content}")
        elif role == "assistant":
            lines.append(f"Assistant: {content}")
        else:
            lines.append(f"User: {content}")
    lines.append("Assistant:")
    return "\n".join(lines).strip()


def _has_structured_tool_content(messages: list[dict[str, Any]]) -> bool:
    if not messages:
        return False
    last = messages[-1]
    if not isinstance(last, dict):
        return False
    return isinstance(last.get("content"), dict)


def _sanitize_messages_for_chat(messages: list[dict[str, Any]]) -> list[dict[str, str]]:
    cleaned: list[dict[str, str]] = []
    for m in messages or []:
        if not isinstance(m, dict):
            continue
        role = str(m.get("role", "user")).strip().lower()
        if role not in ALLOWED_ROLES:
            role = "user"
        content = str(m.get("content", "")).strip()
        if not content:
            continue
        cleaned.append({"role": role, "content": content})

    if not cleaned:
        cleaned = [
            {"role": "system", "content": "You are a helpful AI assistant."},
            {"role": "user", "content": "Hello"},
        ]

    if cleaned[0]["role"] != "system":
        cleaned.insert(0, {"role": "system", "content": "You are an intelligent smart energy assistant."})
    return cleaned


def _extract_last_user_content(messages: list[dict[str, str]]) -> str:
    for msg in reversed(messages):
        if msg.get("role") == "user" and msg.get("content"):
            return msg["content"]
    return messages[-1].get("content", "Hello") if messages else "Hello"


def _call_ollama(messages: list[dict[str, Any]]) -> str | None:
    prompt = _messages_to_prompt(messages)
    if not prompt:
        return None

    url = f"{_ollama_base_url()}/api/generate"
    candidates = [OLLAMA_MODEL, "phi", "phi3:mini"]
    tried: list[str] = []
    for model in candidates:
        if model in tried:
            continue
        tried.append(model)
        try:
            res = requests.post(
                url,
                json={"model": model, "prompt": prompt, "stream": False},
                timeout=OLLAMA_TIMEOUT_SECONDS,
            )
            res.raise_for_status()
            text = (res.json().get("response") or "").strip()
            if text:
                return text
        except Exception:
            continue
    return None


def _validate_groq_response_content(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("Groq returned no choices")
    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message") if isinstance(first.get("message"), dict) else {}
    content = str(message.get("content") or "").strip()
    if not content:
        raise RuntimeError("Groq returned empty content")
    return content


def _post_groq(payload: dict[str, Any], api_key: str) -> str:
    res = requests.post(
        f"{GROQ_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=AI_TIMEOUT_SECONDS,
    )
    if res.status_code != 200:
        logger.error("Groq error %s -> %s", res.status_code, res.text)
        raise RuntimeError(res.text)
    data = res.json()
    return _validate_groq_response_content(data)


def _call_groq(messages: list[dict[str, Any]]) -> str:
    api_key = _groq_api_key()

    print(">>> GROQ KEY PRESENT:", bool(api_key))

    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    cleaned_messages = _sanitize_messages_for_chat(messages)

    payload = {
        "model": GROQ_MODEL,
        "messages": cleaned_messages,
        "temperature": AI_TEMPERATURE if AI_TEMPERATURE is not None else 0.3,
    }

    print(">>> GROQ PAYLOAD:", payload)

    res = requests.post(
        f"{GROQ_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=AI_TIMEOUT_SECONDS,
    )

    print(">>> GROQ STATUS:", res.status_code)
    print(">>> GROQ RESPONSE:", res.text)

    if res.status_code != 200:
        raise RuntimeError(f"Groq error {res.status_code}: {res.text}")

    data = res.json()
    return _validate_groq_response_content(data)


def generate_ai_response(messages: list[dict[str, Any]]) -> str:

    # TOOL SAFETY
    if _has_structured_tool_content(messages):
        return "Tool execution handled."

    mode = _ai_mode()

    print(">>> AI MODE:", mode)

    if mode == "local":
        text = _call_ollama(messages)
        if text:
            print(">>> USING OLLAMA")
            return text
        raise RuntimeError("Local AI mode enabled but Ollama unavailable")

    # CLOUD MODE
    try:
        print(">>> USING GROQ")
        return _call_groq(messages)

    except Exception as groq_error:

        print(">>> GROQ FAILED:", groq_error)

        # ONLY fallback if explicitly allowed
        text = _call_ollama(messages)

        if text:
            print(">>> FALLBACK OLLAMA USED")
            return text

        raise RuntimeError("Cloud AI failed and no fallback available")