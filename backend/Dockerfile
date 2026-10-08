# ============================================================
# Stage 1 — Dependencies
# ============================================================
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./

# Install only production dependencies
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev --no-audit --no-fund; fi

# ============================================================
# Stage 2 — Build
# ============================================================
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ============================================================
# Stage 3 — Production image
# ============================================================
FROM node:22-alpine AS production

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Only bring in compiled JS and production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER appuser

EXPOSE 4000

ENV NODE_ENV=production

# Container-level health probe (compose also defines one; this covers
# `docker run` without compose). wget is available in node:alpine.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health || exit 1

CMD ["node", "dist/server.js"]
