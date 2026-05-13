# syntax=docker/dockerfile:1
# ERA Finance — Docker assets live under ./docker/
#
# Production images (multi-stage Node 22) are defined next to each app; build from repo root:
#   docker build -f apps/api/Dockerfile -t erafinance-api:latest .
#   docker build -f apps/web/Dockerfile -t erafinance-web:latest .
#
# This file is a tiny OCI placeholder so `docker/dockerfile` exists for tooling and discovery.
# It is not used by docker-compose.prod.yml (that compose references apps/api and apps/web directly).

FROM scratch
LABEL org.opencontainers.image.title="ERA Finance (docker layout)"
LABEL org.opencontainers.image.description="Canonical API/Web Dockerfiles: apps/api/Dockerfile, apps/web/Dockerfile. Build context: repository root."
