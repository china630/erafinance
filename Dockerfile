# syntax=docker/dockerfile:1
# ERA Finance Core — data plane API only (:4000), no public Traefik route.
# Build context MUST be umbrella root (sibling @era365/database):
#   docker build -f era-finance-core/Dockerfile -t era-finance-core .

FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl

WORKDIR /workspace

COPY era-365-orchestrator/packages/database ./era-365-orchestrator/packages/database

COPY era-finance-core/package.json era-finance-core/package-lock.json ./era-finance-core/
COPY era-finance-core/apps/api/package.json ./era-finance-core/apps/api/
COPY era-finance-core/apps/web/package.json ./era-finance-core/apps/web/
COPY era-finance-core/packages/database/package.json ./era-finance-core/packages/database/
COPY era-finance-core/packages/api-contracts/package.json ./era-finance-core/packages/api-contracts/
COPY era-finance-core/packages/i18n/package.json ./era-finance-core/packages/i18n/
COPY era-finance-core/packages/ui/package.json ./era-finance-core/packages/ui/

COPY era-finance-core/packages/database ./era-finance-core/packages/database
COPY era-finance-core/packages/api-contracts ./era-finance-core/packages/api-contracts
COPY era-finance-core/packages/i18n ./era-finance-core/packages/i18n
COPY era-finance-core/packages/ui ./era-finance-core/packages/ui
COPY era-finance-core/apps/api ./era-finance-core/apps/api
COPY era-finance-core/apps/web/lib/i18n/resources.ts ./era-finance-core/apps/web/lib/i18n/resources.ts

WORKDIR /workspace/era-finance-core

ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

RUN npm ci
RUN npm run build -w @erafinance/api-contracts \
  && npm run build -w @erafinance/database \
  && npm run build -w @erafinance/api
RUN npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /workspace/era-finance-core /app

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
