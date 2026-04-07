# Task 5 — CI/CD, Load Testing, Scalability, Monitoring

This folder documents **Task 5** deliverables for ShelfSight (CI gates, baseline load, scalability notes, CloudWatch-oriented monitoring).

## A. CI/CD

### Backend (`shelfsight-backend`)

Workflow: `.github/workflows/ci.yml`

| Step   | Command        |
|--------|----------------|
| Lint   | `npm run lint` |
| Build  | `npm run build` (`prisma generate && tsc`) |
| Test   | `npm run test` (Vitest smoke: `GET /health`) |

Runs on: `push` / `pull_request` to `main` or `master`.

### Frontend (`shelfsight-frontend`)

Workflow: `.github/workflows/ci.yml`

| Step       | Command |
|------------|---------|
| Lint       | `npm run lint` |
| Typecheck  | `npm run typecheck` (`tsc --noEmit`) |
| Test       | `npm run test` (Vitest smoke) |
| Build gate | `npm run build:ci` |

**`build:ci`:** `next build --experimental-build-mode compile` — validates compilation and route graph. Full static prerender (`npm run build`) may still hit Next.js 16 + React 19 issues on internal `/_global-error` in some environments; run full `next build` locally or in Vercel when validating production output.

## B. Baseline load test

Script: `scripts/baseline-load.sh` (uses [autocannon](https://github.com/mcollina/autocannon) via `npx`).

```bash
cd shelfsight-backend
npm run dev   # or npm start after build
# another terminal:
./scripts/baseline-load.sh
# Optional:
BASE_URL=http://127.0.0.1:3001 CONCURRENCY=20 DURATION_SEC=10 ./scripts/baseline-load.sh
```

Only **read** endpoints are called: `/health`, `/health/ready`, `GET /books?limit=20`.

### Observed baseline (local dev, sample run)

| Endpoint | Concurrency | Duration | Avg latency | ~Throughput | Notes |
|----------|-------------|----------|-------------|-------------|--------|
| `/health` | 20 | 5s | ~2.8 ms | ~6k req/s | Liveness only |
| `/health/ready` | 20 | 5s | — | — | Hits DB; expect higher latency; 503 if DB unavailable |
| `/books?limit=20` | 20 | 5s | — | — | Must be **unauthenticated** in your API; if routes require auth, results show 401/403 |

**Interpretation:** `/health` is a good cheap load target. `/health/ready` is appropriate for **readiness** probes (DB up). Catalog list cost depends on implementation (see scalability section).

## C. Scalability (review)

See [SCALABILITY.md](./SCALABILITY.md).

## D. Monitoring & alerting

See [CLOUDWATCH.md](./CLOUDWATCH.md).

Production logging:

- **JSON access logs** (`event: http_request`, `statusCode`, `durationMs`, `path`) when `NODE_ENV=production`.
- **JSON error logs** via `logError` in the global error handler (`event: http_error_response`, `code`, `path`, `statusCode`).

No secrets are written to logs. Stack traces are truncated in production error logs.

## E. Environment variables

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `production` enables JSON access + structured error logging |
| `CORS_ORIGIN` | Allowed browser origin (already used by app) |
| `DATABASE_URL` | Required for `/health/ready` and app data |

CloudWatch alarms and metric filters require AWS account setup (see CLOUDWATCH.md).
