# Rework CV — Production Deployment Guide

> Do not deploy, migrate production data, or change live configuration
> without explicit authorization. This guide describes the manual steps.

## 1. Architecture & scaling constraint

- `backend/` (Express, Node 22) — single container via `docker-compose.yml`.
- `frontend/` (React + Vite) — static site; **no container/service in compose**.
- Supabase — Auth + PostgreSQL + private Storage (`resumes` bucket).
- AI providers (server-side only): local Ollama first, Groq/Anthropic/OpenAI fallback.

**Single-replica constraint (do not scale out without rework):**
`RESUME_UPLOAD_MAX_CONCURRENT` (in-memory semaphore) and the RAG
`retrievalCache` (process-local Map, TTL `RAG_CACHE_TTL_MS`, 200-entry cap)
are per-process. `docker-compose.yml` runs exactly one backend replica, which
keeps both coherent. Running N replicas would (a) multiply worst-case upload
RAM by N and (b) delay knowledge-base mutation visibility up to
`RAG_CACHE_TTL_MS` on some instances (mutations clear only the local cache).
If horizontal scaling is ever required, replace both with shared stores first.

## 2. Database migrations (Supabase / PostgreSQL, fresh database)

```bash
# Apply in lexical order (matches numeric order and FK dependencies)
for f in database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

- Order: `001` (extensions) → `002/003` (profiles, resumes) → `012/013`
  (grants, profile fields) → `014` (job analyses) → `017/020/021`
  (legacy-table drops only; guarded, core tables asserted) → `022/023`
  (RAG KB, coach) → `024` (private storage bucket + policies, anon revoke).
- Safe on a **fresh** database (all `CREATE TABLE/INDEX` use `IF NOT EXISTS`;
  `022`/`024` policies are guarded). Re-running the whole directory against
  an **already-migrated** database fails on `003` (`CREATE TYPE` has no
  `IF NOT EXISTS` in Postgres) and duplicate `CREATE POLICY` statements in
  `002/003/014/020/023`. Migrations are forward-only: never edit an applied
  migration, add a new numbered file.
- The `resumes` storage bucket is created idempotently by `024`; no manual
  dashboard step is required.

## 3. Backend (Docker Compose)

```bash
cp backend/.env.example backend/.env   # then fill in real values (below)
docker compose up --build -d
```

- Container: `upskilr-backend:local`, port `4000`, `restart: unless-stopped`.
- Healthcheck: `GET /api/v1/health` every 30s. The response distinguishes
  layers: top-level `status`, `checks.database` (`ok` + latency), and
  `checks.aiProviders[]` (per-provider `configured`/`available` + error).
  The container is unhealthy only if the app itself is down; a failing AI
  provider degrades to deterministic analysis (by design), it does not fail
  the deploy — check the payload, not just the status code.
- Startup fails fast (`process.exit(1)`) on missing/invalid env; production
  additionally rejects `CORS_ORIGIN=*` and localhost origins.

### Required production environment (backend)

| Variable | Notes |
|---|---|
| `NODE_ENV=production` | Enables fail-closed CORS/admin behavior |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Service-role key must never leave the backend |
| `CORS_ORIGIN` | Comma-separated `https://` origins of the deployed frontend |
| `RESUME_STORAGE_BUCKET=resumes` | Must match the bucket created by migration `024` |

Tunable with safe defaults: `BACKEND_PORT` (4000), `LOG_LEVEL` (info),
`RESUME_MAX_FILE_SIZE_BYTES` (5242880), `RESUME_UPLOAD_MAX_CONCURRENT` (4 —
worst-case RAM ≈ limit × max file size + parse overhead; single replica only),
`RESUME_MAX_EXTRACTED_CHARS` (200000), `AI_*` / `LOCAL_AI_*` provider
settings, `RAG_*` settings. `RAG_ADMIN_API_KEY`: leave **unset** to keep
ingest/reindex/delete endpoints fail-closed `403`; when set it must be ≥32
chars (`openssl rand -hex 32`). At least one AI path should be live
(Ollama locally or one cloud key) — otherwise all AI features degrade to
deterministic-only with user-visible warnings.

## 4. Frontend (static hosting — Vercel, Netlify, or any static host)

There is intentionally no frontend container: it is a static SPA.

```bash
cd frontend
cp .env.example .env.local   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
npm ci && npm run build      # emits frontend/dist/
```

- Deploy `frontend/dist/` as a static site with an SPA fallback
  (`/* → /index.html`) so `/analysis`, `/resume/report/*`, `/reset-password`,
  `/auth/callback` resolve on refresh/deep-link.
- `VITE_API_URL` must be the public backend URL + `/api/v1`
  (e.g. `https://api.example.com/api/v1`); `http://` values are rejected at
  startup. The anon key is publishable by design — it is the **only** Supabase
  key that may ship in the bundle (verified: no service-role or provider keys
  in `dist/`).
- Supabase dashboard → Authentication → URL configuration: add the frontend
  origin to redirect URLs (signup `emailRedirectTo …/auth/callback` and
  password-reset flows depend on it).

## 5. Post-deploy verification checklist

1. `GET /api/v1/health` → `status: ok`, `checks.database.status: ok`.
2. Unauthenticated `GET /api/v1/resumes` → `401 AUTHENTICATION_ERROR` with
   `{ error: { code, message, requestId } }` shape.
3. With a dedicated test account + isolated test data only: signup/login →
   upload → process → analyze → report → scan-history reopen → coach
   follow-up → cover letter (verify exact name/email) → both PDF exports.
4. Cross-user probes (second test account): resume, analysis, cover letter,
   coach conversation, and both exports of user 1 must all return `404`.
5. Delete all test records afterwards (resume delete cascades to analyses,
   coach conversations, and cover letters via FK `ON DELETE CASCADE`).

## 6. Logging & secrets

- Structured logs carry `requestId` and error codes only — never passwords,
  tokens, full resumes, or API keys (5xx details are redacted in production).
- Never commit `backend/.env`, `frontend/.env.local`, or any file containing
  real keys (all are gitignored; only `.env.example` placeholders are
  committed).
