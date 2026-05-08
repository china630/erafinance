# Optional monitoring stack (Prometheus + Grafana)

This folder is **not** required for a minimal production rollout. Use it when you want RAM/CPU, HTTP probes, and Redis/BullMQ visibility (checklist step 44 / 58).

## What is included

- **Prometheus** — scrapes itself, optional `node_exporter`, and blackbox-style checks if you extend `prometheus.yml`.
- **Grafana** — dashboards; default admin password must be set via env before exposing publicly.

## Run (alongside app stack)

From the repository root (Compose resolves paths relative to each compose file):

```bash
docker compose -f docker-compose.prod.yml -f docs/deploy/monitoring/docker-compose.monitoring.yml up -d
```

The monitoring compose file lives next to `prometheus.yml` in this directory.

Set `GF_SECURITY_ADMIN_PASSWORD` in `.env` or export before `up`. Do **not** publish Grafana without TLS and strong auth.

## Redis / BullMQ

BullMQ uses the same Redis as the API (`REDIS_URL`). For queue depth inspection without Grafana, use `redis-cli`, Bull Board (not bundled), or RedisInsight against the private Redis endpoint (never expose Redis to the public internet).

## Telegram / external alerts

Application-level webhooks (audit integrity, BullMQ failures) use env vars documented in `env.production.example` and `docs/launch/STAGE_B_INFRASTRUCTURE.md`.
