# Dual-Storage Strategy for Rate Limiting and Audit Logs

We split gateway telemetry into a hot path and an audit path: Redis handles low-latency (<1ms) sliding-window rate limiting and active key verification, while PostgreSQL stores immutable, time-ordered (UUIDv7) request logs for historical analytics. This prevents write amplification from degrading gateway response times under heavy load.
