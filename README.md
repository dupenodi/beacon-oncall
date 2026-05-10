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
# edit .env — set DATABASE_URL, APP_MASTER_KEY, INTERNAL_TICK_SECRET (tick), optional RESEND_* (see .env.example)

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
| `npm test` | Vitest in workspaces that define `test` |
| `npm run db:generate` | Drizzle SQL from schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Insert demo org/service/policy (requires `APP_MASTER_KEY`) |
| `npm run start -w @beacon/simulator -- …` | Run simulator CLI (see CP07; args after `--`) |

## CI

GitHub Actions runs `npm ci`, `npm run typecheck`, and `npm test` on pushes/PRs to `main` (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## GitHub repo bootstrap (one-time)

If you still need to wire a remote:

```bash
gh auth login -h github.com
./scripts/bootstrap-git-and-github.sh
```
