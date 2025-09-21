# Realtime API Agents Demo

This is a demonstration of more advanced patterns for voice agents, using the OpenAI Realtime API and the OpenAI Agents SDK. This repository was forked from [openai/openai-realtime-agents](https://github.com/openai/openai-realtime-agents) and extended with a DoorDash-style multi-agent experience.

## DoorDash Multi-Agent Scenario

- Configuration lives in `src/app/agentConfigs/doorDashMultiAgent.ts` and is available from the scenario dropdown inside the demo UI.
- The experience routes customers between a concierge, ordering desk, promotions concierge, recommendations expert, and refund agent using realtime handoffs.
- Agents share reusable tools like `createOrderRecord` / `fetchOrderRecord` (backed by Neon), promotion lookups, and refund/replacement helpers to keep context in sync.
- Use the Neon setup below to persist live order data so agents can place and retrieve orders during a session.