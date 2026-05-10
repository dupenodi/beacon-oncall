# beacon-oncall

Private **incident routing / escalation** portfolio (multi-tenant API, timer-based escalation, webhooks, email, action agent).

**Implementation spec:** [`docs/BEACON_SPEC.md`](docs/BEACON_SPEC.md) (checkpoints CP00–CP10).

## Monorepo layout

| Path | Purpose |
|------|---------|
| [`apps/web`](apps/web) | Next.js (App Router) UI |
| [`apps/api`](apps/api) | Hono HTTP API (`/health`, `/v1/*`, `/public/*`, `/internal/tick`) |
| [`packages/db`](packages/db) | Drizzle schema + migrations |
| [`packages/ai`](packages/ai) | `ChatModel` (`MockChatModel`, `OpenAiChatModel`) + GitHub comment helper |
| [`tools/simulator`](tools/simulator) | `beacon-sim` CLI — signed webhook traffic (`steady` / `burst`) |
| [`tools/go-relay`](tools/go-relay) | Optional CP10 Go poller for `/internal/tick` |

## Prerequisites

- **Node.js 20+** (repo tested on Node 22)
- **npm** (workspaces; `package-lock.json` is committed for CI)

## Local development

```bash
cd beacon-oncall
cp .env.example .env
# edit .env — every variable is documented in .env.example with "how to get" notes

npm install
npm run dev
```

- **Web:** [http://localhost:3000](http://localhost:3000) — home, [`/public/demo/status`](http://localhost:3000/public/demo/status), [`/orgs/demo/incidents`](http://localhost:3000/orgs/demo/incidents)
- **API:** [http://localhost:3001/health](http://localhost:3001/health)

Stop dev: `Ctrl+C` (concurrently kills both).

## Database migrations

```bash
# Apply committed migrations to your database (Neon or local Postgres)
DATABASE_URL="postgresql://..." npm run db:migrate
```

If you previously ran the old **`beacon_meta`** placeholder migration, **reset that database** (or `DROP TABLE beacon_meta;`) before applying the new baseline migration `0000_faulty_firelord.sql`.

After migrate, seed demo data (org `demo`, users, service, 2-step policy):

```bash
DATABASE_URL="postgresql://..." APP_MASTER_KEY="$(openssl rand -hex 32)" npm run db:seed
```

The seed prints a **dev-only** webhook plaintext (`whsec_dev_demo_change_me`) for later simulator / CP04 work. Demo users get an Argon2 password hash; default password is **`demo`** (override with `DEMO_SEED_PASSWORD` in `.env`).

### Auth (CP02)

After migrate + seed, sign in with the cookie session API:

```bash
# login (sets HttpOnly beacon_session cookie in -c jar)
curl -s -c /tmp/beacon.cookies -b /tmp/beacon.cookies -X POST http://localhost:3001/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.invalid","password":"demo"}'

curl -s -b /tmp/beacon.cookies http://localhost:3001/v1/auth/me
curl -s -b /tmp/beacon.cookies http://localhost:3001/v1/orgs/demo/me
curl -s -b /tmp/beacon.cookies http://localhost:3001/v1/orgs/demo/services
```

Org routes return **403** if the signed-in user has no membership for that org slug.

### Incidents (CP03)

Create requires a **bound policy with at least step 0** on the target service (the seed already sets this up).

```bash
# after login (see cookie jar above), replace SERVICE_ID from GET .../services
curl -s -b /tmp/beacon.cookies http://localhost:3001/v1/orgs/demo/services
curl -s -b /tmp/beacon.cookies -X POST http://localhost:3001/v1/orgs/demo/incidents \
  -H 'Content-Type: application/json' \
  -d '{"serviceId":"'"$SERVICE_ID"'","title":"Payments elevated errors","severity":"SEV2"}'

curl -s -b /tmp/beacon.cookies 'http://localhost:3001/v1/orgs/demo/incidents?status=open'
curl -s -b /tmp/beacon.cookies http://localhost:3001/v1/orgs/demo/incidents/INCIDENT_ID
curl -s -b /tmp/beacon.cookies http://localhost:3001/v1/orgs/demo/incidents/INCIDENT_ID/events
curl -s -b /tmp/beacon.cookies -X POST http://localhost:3001/v1/orgs/demo/incidents/INCIDENT_ID/ack
curl -s -b /tmp/beacon.cookies -X POST http://localhost:3001/v1/orgs/demo/incidents/INCIDENT_ID/resolve
```

- **Ack** is only valid when `status` is `open` (409 otherwise).
- **Resolve** is allowed from `open` or `acknowledged`, and is **idempotent** when already `resolved` (204).

Schema + migrations live under [`packages/db/`](packages/db/).

### Webhook ingest (CP04)

`POST /v1/webhooks/:orgSlug/ingest` with **raw JSON body** (same bytes used for the MAC). Headers: `X-Beacon-Timestamp` (unix seconds), `X-Beacon-Signature` (`v1=<lowercase-hex>`). Secret is the org plaintext from seed or `POST /v1/orgs/:orgSlug/webhook-secret/rotate` (owner only).

### Services, policies, bind (CP05)

Authenticated under `/v1/orgs/:orgSlug/`: `POST|GET /services`, `PATCH /services/:id`, `POST|GET /policies`, `POST /services/:id/policy` (body `{ policyId }`).

### Escalation tick (CP06)

`POST /internal/tick` with header `X-Internal-Auth: $INTERNAL_TICK_SECRET` (min 32 characters). Returns `{ processed, advanced, errors }`.

### Email (CP07)

When `RESEND_API_KEY` and `EMAIL_FROM` are set, notifications use [Resend](https://resend.com); otherwise the API uses a no-op console notifier (fine for local dev).

Scheduled workflows (no-op until secrets exist): [`.github/workflows/tick.yml`](.github/workflows/tick.yml), [`.github/workflows/simulate.yml`](.github/workflows/simulate.yml).

**Simulator:** `npm run start -w @beacon/simulator -- steady --baseUrl http://localhost:3001 --orgSlug demo --serviceId <uuid> --secret <plaintext>` (use `burst` with `--count N` for sequential bursts).

### Public status (CP08)

- API: `GET /public/:orgSlug/status` (no session).
- Web: server-rendered page at `/public/[orgSlug]/status`.

### Action agent (CP09)

- **Model:** `@beacon/ai` — `createChatModel()` uses `OpenAiChatModel` when `OPENAI_API_KEY` is set, else `MockChatModel` (CI-safe).
- **GitHub integration (owner):** `GET/PUT /v1/orgs/:orgSlug/integrations/github` — body `{ "pat": "ghp_...", "defaultRepo": "owner/repo" }`; PAT encrypted with `APP_MASTER_KEY` like other secrets.
- **Runs:** `POST /v1/orgs/:orgSlug/incidents/:incidentId/action-runs` → `{ runId }`; `GET .../action-runs/:runId`; `POST .../action-runs/:runId/approve` executes `github.issue_comment` when a pending tool step exists.
- **Web:** `/orgs/[orgSlug]/incidents/[incidentId]/agent` — minimal create / load / approve buttons (session cookie to API).

### Go relay (CP10, optional)

See [`tools/go-relay/README.md`](tools/go-relay/README.md). Build with Go 1.22+; not part of `npm run build`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API + web in parallel |
| `npm run build` | Production build (web then api) |
| `npm run typecheck` | `tsc` in all workspaces |
| `npm test` | Vitest in workspaces that define `test` (API unit tests only; Postgres integration is separate) |
| `npm run verify` | `typecheck` + `test` + `build` (local gate before push) |
| `npm run db:generate` | Drizzle SQL from schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Insert demo org/service/policy (requires `APP_MASTER_KEY`) |
| `npm run test:integration` | Postgres + Testcontainers suite (`tick`, resolve skip, ack/tick race, webhook dedupe, CP09 approve mock); requires Docker |
| `npm run start -w @beacon/simulator -- …` | Run simulator CLI (see CP07; args after `--`) |

## CI

GitHub Actions runs `npm ci` and `npm run verify` on pushes/PRs to `main`, plus a separate **`integration`** job that runs `npm run test:integration -w @beacon/api` (Docker on the runner). See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Deployment (ordered checklist)

**Environment variable reference:** every key the apps use, plus **how to obtain** each one, is documented in [`.env.example`](.env.example). Copy it to `.env` for local dev (`cp .env.example .env`). Production values go in your host’s **secret manager** / dashboard, not in git.

1. **Postgres** — Create a database (Neon, RDS, Cloud SQL, etc.). Copy the connection string into **`DATABASE_URL`** (see `.env.example`). The API and migration scripts must reach it from your laptop or CI (use `sslmode=require` in the URL for typical cloud hosts).

2. **Core secrets** — Set **`APP_MASTER_KEY`** (`openssl rand -hex 32`) and **`INTERNAL_TICK_SECRET`** (≥ 32 random characters, e.g. `openssl rand -hex 32`). Same `INTERNAL_TICK_SECRET` value is used for **`X-Internal-Auth`** when calling `/internal/tick`. Store in the platform’s env UI; never commit.

3. **Migrations** — On a machine that can reach the DB, from repo root:  
   `DATABASE_URL="postgresql://…" npm run db:migrate`  
   Run once per new database before serving traffic.

4. **Seed (non‑prod only, optional)** — Demo org and users:  
   `DATABASE_URL="…" APP_MASTER_KEY="…" npm run db:seed`  
   Override demo password with **`DEMO_SEED_PASSWORD`** if you set it before seeding. For real production tenants, plan a separate onboarding path instead of the dev seed.

5. **Deploy API** — Build/run `apps/api` on Node 20+. Required env: **`DATABASE_URL`**, **`APP_MASTER_KEY`**, **`INTERNAL_TICK_SECRET`**, **`NODE_ENV=production`**. Optional: **`API_PORT`**, **`RESEND_API_KEY`** + **`EMAIL_FROM`**, **`PUBLIC_WEB_ORIGIN`**, **`OPENAI_API_KEY`** (+ **`OPENAI_MODEL`**), session overrides in `.env.example`.

6. **Deploy web** — Build/run `apps/web` (Next.js). Set **`NEXT_PUBLIC_API_URL`** to the **browser-visible** API origin (e.g. `https://api.yourdomain.com`, no trailing slash). Rebuild the web app whenever this changes (it is baked in at build time).

7. **Cookies / cross-origin** — Sessions use **HttpOnly**, **SameSite=Lax**, **Secure** when `NODE_ENV=production`. If web and API are on different registrable domains, login flows that rely on cookies to the API origin need a deliberate layout (shared parent domain, reverse proxy under one host, or future token-based changes).

8. **GitHub Actions** — Not stored in `.env`. In the repo **Settings → Secrets and variables → Actions**, configure:  
   - **Tick:** `API_BASE_URL`, `INTERNAL_TICK_SECRET` (see [`.github/workflows/tick.yml`](.github/workflows/tick.yml)).  
   - **Simulator (optional):** `SIM_BASE_URL`, `SIM_ORG_SLUG`, `SIM_SERVICE_ID`, `SIM_WEBHOOK_SECRET` (see [`.github/workflows/simulate.yml`](.github/workflows/simulate.yml)). Names and meanings are summarized at the bottom of `.env.example`.

9. **Smoke test** — `GET /health` and `GET /health/db` on the API; open the web app, sign in, list incidents; `GET /public/<orgSlug>/status` without auth; optional `POST …/internal/tick` with `X-Internal-Auth: <INTERNAL_TICK_SECRET>`.

### Deploy online: Vercel (web) + Render (API) — where to click

This app is **two processes**: a **Next.js** site (`apps/web`) and a **long-running Node HTTP API** (`apps/api`, Hono + `@hono/node-server`). **Vercel is ideal for the Next app.** The API is a normal Node server, so run it on **Render**, **Railway**, **Fly.io**, or similar—not as a serverless-only bundle unless you add a Vercel adapter later.

#### A. API on Render (recommended)

**Build note:** Render may run `npm ci` with production pruning. `typescript` and `@types/node` are **`dependencies`** of `@beacon/api` so `tsc` still runs; Vitest-only deps stay in `devDependencies`. A **`.node-version`** file pins Node **22** for the service (avoids picking an experimental default like 26).

1. Open **[render.com](https://render.com)** → sign in → **Dashboard**.
2. Click **New +** → **Web Service**.
3. **Connect** your GitHub account if asked → select the **`beacon-oncall`** repository.
4. Configure the service:
   - **Name:** e.g. `beacon-api`
   - **Region:** closest to you / your DB
   - **Branch:** `main` (or your default branch)
   - **Root directory:** leave **empty** (repo root) so `npm` workspaces resolve.
   - **Runtime:** **Node**
   - **Build command:** `npm ci && npm run build -w @beacon/api`
   - **Start command:** `npm run start -w @beacon/api`
5. Open **Environment** (left sidebar or tab) → **Add environment variable** for each production value from [`.env.example`](.env.example), at minimum:
   - `DATABASE_URL`, `APP_MASTER_KEY`, `INTERNAL_TICK_SECRET`, `NODE_ENV=production`
   - Optional: `RESEND_API_KEY`, `EMAIL_FROM`, `PUBLIC_WEB_ORIGIN`, `OPENAI_API_KEY`, etc.
6. Under **Health Check Path**, set **`/health`** if the UI offers it.
7. Click **Create Web Service** and wait for deploy. Copy the **public URL** (e.g. `https://beacon-api.onrender.com`) — you will use it as **`NEXT_PUBLIC_API_URL`** for the web app.

**Migrations:** run `DATABASE_URL=… npm run db:migrate` once from your laptop (or a one-off Render **Shell** / local script) against the **same** database before relying on the deployed API.

#### B. Web on Vercel

1. Open **[vercel.com](https://vercel.com)** → **Log in** → **Add New…** → **Project**.
2. **Import** the same GitHub repo (`beacon-oncall`).
3. Under **Configure Project**:
   - **Root Directory:** **`apps/web`**
   - **Framework Preset:** Next.js (default).
   - **Install Command:** `cd ../.. && npm ci`  
     (must run from monorepo root so workspaces and `package-lock.json` resolve.)
   - **Build Command:** `cd ../.. && npm run build -w @beacon/web`
4. **Environment Variables** (same screen or **Settings → Environment Variables**):
   - `NEXT_PUBLIC_API_URL` = your **Render API URL** (e.g. `https://beacon-api.onrender.com`, no trailing slash).
   - `NODE_ENV` = `production` (often set automatically).
5. **Deploy**. After the first deploy, open the **`.vercel.app`** URL Vercel shows.

**If the build fails:** In the project **Settings → General → Root Directory**, confirm `apps/web`. Check the **Build** log: `npm ci` must run from the directory that contains the root `package-lock.json` (`cd ../..` from `apps/web`).

#### C. Both apps on Render (alternative)

Repeat **section A** twice: one Web Service for the API (same build/start as above), a second Web Service for the web with **Build:** `npm ci && npm run build -w @beacon/web` and **Start:** `npm run start -w @beacon/web`, and env **`NEXT_PUBLIC_API_URL`** pointing at the first service’s URL.

#### Cookies note (web and API on different hosts)

The UI logs in against the **API** origin; the session cookie is set for that host. Putting **API** and **Web** on different apex domains (e.g. Vercel + Render defaults) often breaks cookie-based login in the browser. Mitigations: use a **custom domain** so both sit under one site (e.g. `app.yourdomain.com` and `api.yourdomain.com` with careful configuration), put **both** behind one reverse proxy, or plan a **token-in-header** auth change for strict cross-origin setups.

### Optional: real GitHub comment (CP09 manual)

1. Fork a repo with at least one issue (note `owner/repo` and issue number `1` or another).
2. Create a fine-grained PAT with **Issues: write** on that fork.
3. In the app as org **owner**: `PUT /v1/orgs/:orgSlug/integrations/github` with `{ "pat": "…", "defaultRepo": "yourfork/yourrepo" }`.
4. Open an incident → **Agent** → create action run (mock model proposes `issue_number: 1` unless you use OpenAI with structured output).
5. **Approve** — should create a comment on the issue; verify in the GitHub UI.

## GitHub repo bootstrap (one-time)

If you still need to wire a remote:

```bash
gh auth login -h github.com
./scripts/bootstrap-git-and-github.sh
```
