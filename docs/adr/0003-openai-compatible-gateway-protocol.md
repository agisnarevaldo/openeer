# OpenAI-Compatible Gateway Protocol

We implemented the gateway endpoint as an OpenAI-compatible interface (`/v1/chat/completions`) with matching JSON and SSE streaming schemas alongside OpenAI error envelopes. This allows any existing OpenAI SDK, Vercel AI SDK, or LLM tooling to target Openeer by merely updating the `baseURL` and API key.
