# Beacon On-Call

Multi-tenant **incident routing**: services, escalation policies, signed webhooks, a scheduled **escalation tick**, optional email (Resend), public status, and an optional **human-in-the-loop** agent (OpenAI or mock) that can propose GitHub issue comments.

**Stack:** Next.js (App Router) · Hono API on Node · Postgres + Drizzle · cookie auth.

Details: [`docs/BEACON_SPEC.md`](docs/BEACON_SPEC.md) · configuration: [`.env.example`](.env.example)

## Layout

| Path | Role |
|------|------|
| [`apps/web`](apps/web) | UI |
| [`apps/api`](apps/api) | REST API |
| [`packages/db`](packages/db) | Schema + migrations |
| [`packages/ai`](packages/ai) | Agent + GitHub helper |
| [`tools/simulator`](tools/simulator) | Webhook load CLI |

## Local

```bash
cp .env.example .env   # edit values
npm install
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000) — login shows **seeded demo** shortcuts after `db:seed`.
- API: [http://localhost:3001/health](http://localhost:3001/health)

```bash
DATABASE_URL="postgresql://…" npm run db:migrate
DATABASE_URL="postgresql://…" APP_MASTER_KEY="$(openssl rand -hex 32)" npm run db:seed
```

## Scripts

`npm run dev` · `npm run build` · `npm run typecheck` · `npm test` · `npm run verify` · `npm run db:migrate` / `db:seed` / `db:generate` · `npm run test:integration` (Docker)

## CI & deploy

CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) on `main`.

Deploy: Postgres + migrate; run the API (Node) with env from `.env.example`; build the web app with `NEXT_PUBLIC_API_URL` set to the API’s public origin.
