# DEPLOYMENT SAFETY CHECKS

Use this checklist before final deployment/presentation.

## 1) Backend Boot Safety

- Command:
  `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
- Expected:
  - App starts without import/runtime exceptions
  - Startup hook runs (`initialize_demo_state`)

## 2) CORS Safety

- Verify CORS middleware exists in `backend/main.py`.
- Confirm frontend can call backend endpoints from deployed domain.
- Current setting allows all origins (`*`) for demo flexibility.

## 3) Scheduler Safety

- Validate scheduling endpoints:
  - `POST /schedule`
  - `GET /schedule`
- Validate scheduler execution path:
  - `GET /system/status` triggers `run_schedules()`

## 4) AI Routing Boot Safety

- App startup must not depend on live AI provider.
- Confirm backend starts even if `GROQ_API_KEY` is absent.
- AI calls should fail gracefully at request-time, not boot-time.

## 5) Fallback Safety

- With `AI_MODE=cloud` and valid key:
  - Groq responses should work.
- If Groq fails:
  - Ollama fallback is attempted via `OLLAMA_URL`.
- If both unavailable:
  - Chat returns controlled safe fallback text, no crash.

## 6) Frontend Availability

- Render static site should serve `frontend/index.html`.
- Backend API should be reachable from frontend via configured API base URL.

## 7) Production Smoke Endpoints

- `GET /`
- `GET /system/status`
- `GET /tariff/current`
- `GET /billing/estimate`
- `POST /chat/query` (authenticated flow)

## 8) Security / Secrets

- `GROQ_API_KEY` must be set in Render secrets, not hardcoded.
- `.env` must not be committed.
- Use `.env.example` as template only.
