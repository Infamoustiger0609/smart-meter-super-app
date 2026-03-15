# SMART METER SUPER APP

SMART METER SUPER APP is a full-stack smart electricity management platform with a FastAPI backend and static frontend dashboard. It combines deterministic automation, AI orchestration, and simulation to demonstrate intelligent household energy operations.

## Project Overview

The platform is built to help users and admins:
- Monitor energy usage in near real-time
- Control and schedule home appliances
- Simulate tariff-aware optimization decisions
- Track billing and prepaid/postpaid balance behavior
- Analyze carbon footprint and solar generation
- Interact with an AI assistant for control + knowledge tasks

## Architecture

### Frontend
- Static HTML/CSS/JS dashboard in `frontend/`
- API-driven UI for appliances, billing, optimization, and AI chat

### FastAPI Backend
- Entry point: `backend/main.py`
- Domain modules for tariff, billing, meter, appliance simulation, and scheduling
- Router-based API organization under `backend/routers/`

### AI Routing Layer
- Central AI gateway: `backend/ai_engine.py`
- Provider routing by environment mode (`AI_MODE`)

### Groq Cloud AI
- OpenAI-compatible Groq chat completions API
- Default cloud mode for deployment use

### Local Ollama Fallback
- Local model fallback via `OLLAMA_URL` when cloud fails/unavailable
- Useful for offline development and demos

### RAG Knowledge Engine
- Knowledge retrieval + intent classification in `backend/services/chat_rag.py`
- Deterministic tool routing before fallback generation

### Simulation Engine
- In-memory state for appliances, billing, balance, schedules, solar, and admin actions
- Startup bootstrap seeding for demo-ready flows

## Core Features

- Natural language appliance control
- Navigation assistant for dashboard sections
- Billing insights and payment status tracking
- Consumption history queries
- Carbon footprint analytics
- Tariff-aware optimization and what-if simulation
- Balance tracking and top-up forecasting
- Scheduling automation for appliances
- Service request handling and admin complaint workflow
- Solar generation and savings analytics

## Local Setup

1. Create virtual environment:
```bash
python -m venv venv
```

2. Activate environment:
```bash
# Windows (PowerShell)
venv\Scripts\Activate.ps1
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run backend:
```bash
uvicorn backend.main:app --reload
```

5. Open frontend:
- Open `frontend/index.html` in browser
- Set API base in UI to `http://127.0.0.1:8000`

## Environment Variables

Use `.env` (or platform env vars):

- `GROQ_API_KEY` : Groq API key
- `AI_MODE` : `cloud` or `local`
- `GROQ_MODEL` : e.g. `llama-3.3-70b-versatile`
- `OLLAMA_URL` : e.g. `http://localhost:11434`

See `.env.example` for template values.

## Render Deployment

This repo includes a `render.yaml` blueprint for:
- Backend web service (FastAPI)
- Static frontend service

### Deploy Steps

1. Push repository to GitHub.
2. In Render, create Blueprint from repository.
3. Render auto-detects `render.yaml`.
4. Set environment secrets in Render dashboard:
   - `GROQ_API_KEY`
   - Optional: `AI_MODE`, `GROQ_MODEL`, `OLLAMA_URL`
5. Deploy and verify backend health path `/`.
6. Open frontend static site and set API base to backend URL.

## Deployment Safety

See `DEPLOYMENT_SAFETY_CHECKS.md` for startup, CORS, scheduler, AI fallback, and runtime verification checklist.

## Demo

See `DEMO_GUIDE.md` for a recommended hackathon presentation flow.

## API Usage Optimization

See `API_USAGE_OPTIMIZATION.md` for deterministic routing strategy that reduces external LLM calls.

##

URL- https://smart-meter-super-app.onrender.com/
