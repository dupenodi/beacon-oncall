# beacon-oncall

Private **incident routing / escalation** portfolio (multi-tenant API, timer-based escalation, webhooks, email, action agent—see plan in repo wiki or your local notes).

## Monorepo layout

| Path | Purpose |
|------|---------|
| [`apps/web`](apps/web) | Next.js (App Router) UI |
| [`apps/api`](apps/api) | Hono HTTP API (`/health`, `/health/db`) |
| [`packages/db`](packages/db) | Drizzle schema + migrations |

## Prerequisites

- **Node.js 20+** (repo tested on Node 22)
- **npm** (workspaces; `package-lock.json` is committed for CI)

## Local development

```bash
cd beacon-oncall
cp .env.example .env
# edit .env — set DATABASE_URL when you want /health/db to pass

npm install
npm run dev
```

- **Web:** [http://localhost:3000](http://localhost:3000) (home page calls API `/health`)
- **API:** [http://localhost:3001/health](http://localhost:3001/health)

Stop dev: `Ctrl+C` (concurrently kills both).

## Database migrations

```bash
# after changing packages/db/src/schema.ts
DATABASE_URL="postgresql://..." npm run db:generate
DATABASE_URL="postgresql://..." npm run db:migrate
```

Initial migration lives under [`packages/db/drizzle/`](packages/db/drizzle/).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API + web in parallel |
| `npm run build` | Production build (web then api) |
| `npm run typecheck` | `tsc` in all workspaces |
| `npm run db:generate` | Drizzle SQL from schema |
| `npm run db:migrate` | Apply migrations |

## CI

GitHub Actions runs `npm ci` and `npm run typecheck` on pushes/PRs to `main` (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## GitHub repo bootstrap (one-time)

If you still need to wire a remote:

```bash
gh auth login -h github.com
./scripts/bootstrap-git-and-github.sh
```
