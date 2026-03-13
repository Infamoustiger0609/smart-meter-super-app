# DEMO GUIDE - SMART METER SUPER APP

## Suggested Hackathon Demo Flow

1. Open Dashboard Overview
- Show live system status, total load, tariff, and optimization cards.

2. Toggle Appliances
- Turn ON/OFF one or multiple appliances.
- Show immediate load and cost impact.

3. Tariff Simulation / What-If
- Run a what-if schedule time simulation.
- Highlight savings and CO2 reduction differences.

4. AI Navigation Command
- Ask: "Open billing page" or "Take me to solar dashboard".
- Show deterministic routing and action response.

5. Billing Insights
- Show current bill snapshot, unpaid status, and estimate endpoint.

6. AI General Question
- Ask: "How can I reduce my electricity bill monthly?"
- Demonstrate knowledge routing + fallback response handling.

7. Carbon + Solar Analytics
- Show carbon footprint endpoint and solar generation/savings data.

8. Admin Flow (Optional)
- Show complaint/service request lifecycle and admin update endpoints.

## Demo Tips

- Keep `AI_MODE=cloud` for cloud inference demo.
- Keep local Ollama running if you want fallback resilience in live demo.
- Preload sample data by restarting backend (startup bootstrap).
