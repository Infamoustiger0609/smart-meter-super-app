# API Usage Optimization Note

The chatbot pipeline is optimized to reduce unnecessary external LLM (Groq) calls.

## Strategy

1. Deterministic routing first
- Executable intents (device control, navigation, billing/consumption structured queries) are routed directly to tool handlers.

2. RAG second
- Only non-deterministic knowledge queries proceed to retrieval.

3. LLM fallback last
- LLM is called only when deterministic routing is not applicable and retrieval confidence is low.

## Benefit

- Lower token and request consumption on Groq
- Faster response for executable commands
- More predictable behavior for control actions
- Better cost efficiency in production
