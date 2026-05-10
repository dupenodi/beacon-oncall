# beacon-oncall

Private **incident routing / escalation** portfolio (multi-tenant API, timer-based escalation, webhooks, email, action agent).

**Implementation spec:** [`docs/BEACON_SPEC.md`](docs/BEACON_SPEC.md) (checkpoints CP00–CP10).

## Monorepo layout

| Path | Purpose |
|------|---------|
| [`apps/web`](apps/web) | Next.js (App Router) UI |
| [`apps/api`](apps/api) | Hono HTTP API (`/health`, `/v1/auth/*`, `/v1/orgs/*`) |
| [`packages/db`](packages/db) | Drizzle schema + migrations |

## Prerequisites

- **Node.js 20+** (repo tested on Node 22)
- **npm** (workspaces; `package-lock.json` is committed for CI)

## Local development

```bash
cd beacon-oncall
cp .env.example .env
# edit .env — set DATABASE_URL, APP_MASTER_KEY (see .env.example)

npm install
npm run dev
```

- **Web:** [http://localhost:3000](http://localhost:3000) (home page calls API `/health`)
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

Schema + migrations live under [`packages/db/`](packages/db/).

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

## CI

GitHub Actions runs `npm ci` and `npm run typecheck` on pushes/PRs to `main` (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## GitHub repo bootstrap (one-time)

If you still need to wire a remote:

```bash
gh auth login -h github.com
./scripts/bootstrap-git-and-github.sh
```
