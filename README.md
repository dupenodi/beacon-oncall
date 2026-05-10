# Beacon On-Call

Beacon is a **multi-tenant on-call-style stack**: incidents bound to services and escalation policies, signed webhook ingest, a timer-driven escalation tick, email notifications (Resend when configured), a public status endpoint, and an optional agent that can propose GitHub issue comments behind human approval.

**Web:** Next.js (App Router) · **API:** Hono on Node · **DB:** Postgres + Drizzle · **Auth:** cookie sessions · **AI:** OpenAI or a deterministic mock for CI.

Full design and API checkpoints live in [`docs/BEACON_SPEC.md`](docs/BEACON_SPEC.md). Every environment variable is described in [`.env.example`](.env.example).

## Repo layout

| Path | Role |
|------|------|
| [`apps/web`](apps/web) | Next.js UI |
| [`apps/api`](apps/api) | HTTP API (`/health`, `/v1/*`, `/public/*`, `/internal/tick`) |
| [`packages/db`](packages/db) | Schema + migrations |
| [`packages/ai`](packages/ai) | Chat model + GitHub comment helper |
| [`tools/simulator`](tools/simulator) | Signed webhook CLI (`steady` / `burst`) |
| [`tools/go-relay`](tools/go-relay) | Optional Go poller for `/internal/tick` |

## Requirements

- Node.js **20+** (CI uses 22)
- **npm** (workspaces; lockfile committed)

## Run locally

```bash
cp .env.example .env   # then edit values
npm install
npm run dev
```

- Web: [http://localhost:3000](http://localhost:3000) (e.g. `/orgs/demo/incidents`, `/public/demo/status`)
- API: [http://localhost:3001/health](http://localhost:3001/health)

Stop with `Ctrl+C`.

## Database

```bash
DATABASE_URL="postgresql://…" npm run db:migrate
DATABASE_URL="postgresql://…" APP_MASTER_KEY="$(openssl rand -hex 32)" npm run db:seed
```

Seed creates org **`demo`**, sample users (password **`demo`** unless `DEMO_SEED_PASSWORD` is set), a service, policy, and sample incidents. It prints a dev webhook secret for local simulators.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | API + web together |
| `npm run build` | Production build |
| `npm run typecheck` | Typecheck all workspaces |
| `npm test` | Unit tests |
| `npm run verify` | Typecheck + tests + builds (good pre-push gate) |
| `npm run db:migrate` / `db:seed` / `db:generate` | Drizzle migrate, seed, generate SQL |
| `npm run test:integration` | API integration tests (Docker) |
| `npm run live:tick` / `npm run live:webhook` | One-shot tick / webhook sim (needs `SIM_*` in `.env`; see `.env.example`) |

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm run verify` on push/PR to `main`, plus an **integration** job with Docker.

Optional scheduled workflows ([`tick.yml`](.github/workflows/tick.yml), [`simulate.yml`](.github/workflows/simulate.yml)) POST `/internal/tick` and run the simulator when repository secrets are set—see `.env.example` for names (`API_BASE_URL`, `INTERNAL_TICK_SECRET`, `SIM_*`).

## Deploy (outline)

1. **Postgres** — set `DATABASE_URL`; run migrations before traffic.
2. **API** — Node service with at least `DATABASE_URL`, `APP_MASTER_KEY`, `INTERNAL_TICK_SECRET`, `NODE_ENV=production`. Optional: Resend, `PUBLIC_WEB_ORIGIN`, `OPENAI_API_KEY`, `BEACON_GITHUB_ISSUE_NUMBER` (forces GitHub issue for the agent), etc.—all in `.env.example`.
3. **Web** — Next build with `NEXT_PUBLIC_API_URL` pointing at the public API origin (no trailing slash). Rebuild when that URL changes.

**Typical split:** Next on Vercel (`apps/web` as root; install/build from monorepo root—see `.env.example` comments), API on Render or similar (`npm run build` / `start` for `@beacon/api` from repo root). If web and API use unrelated apex domains, cookie auth to the API may need a shared parent domain or proxy; that is a normal constraint for this pattern.

## Optional: GitHub repo bootstrap

```bash
gh auth login -h github.com
./scripts/bootstrap-git-and-github.sh
```
