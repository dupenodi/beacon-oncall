# go-relay (CP10 optional)

Minimal **Go** helper to call the same `POST /internal/tick` endpoint the TypeScript API exposes. TypeScript remains the migration owner; this binary is optional for deployments that prefer a tiny long-running poller.

## Build

```bash
cd tools/go-relay
go build -o beacon-relay .
```

## Run

```bash
export API_BASE_URL="https://your-api.example.com"
export INTERNAL_TICK_SECRET="your-long-secret"
./beacon-relay
```

Environment variables:

| Name | Required | Purpose |
|------|----------|---------|
| `API_BASE_URL` | yes | API origin (no trailing slash required) |
| `INTERNAL_TICK_SECRET` | yes | Same value as the API `INTERNAL_TICK_SECRET` |
| `TICK_INTERVAL` | no | Default `5m` (Go duration string) |

## CI

This directory is **not** wired into `npm` workspaces. Add a separate GitHub Actions job with `actions/setup-go` if you want to compile or release the relay.
