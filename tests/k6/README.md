# k6 Load Testing

This folder contains the multi-user load test suite for ShelfSight.

## Coverage

- `smoke`:
  - Auth login/logout
  - Catalog list/search
  - Loan listing
- `multi-user`:
  - `auth_flow`: `/auth/login`, `/auth/me`, `/auth/logout`
  - `catalog_flow`: catalog search/filter/detail via `/books`
  - `circulation_flow`: `/loans` list + checkout/checkin cycle
  - `ingestion_flow`: `/ingest/jobs`, `/ingest/lookup`, `/ingest/analyze`, job detail/reject

## Prerequisites

1. Backend API is running on port `3001`.
2. Seed users exist (default seed credentials are used):
   - password: `password123`
3. Docker is available if local `k6` is not installed.

## Run

From `shelfsight-backend`:

```bash
npm run test:k6:smoke
npm run test:k6:load
```

Quick profile:

```bash
npm run test:k6:load -- --profile quick
```

## Environment variables

- `K6_BASE_URL` (default local k6: `http://localhost:3001`, Docker k6: `http://host.docker.internal:3001`)
- `K6_PASSWORD` (default `password123`)
- `K6_PROFILE` (`quick` or `task3`, default `task3`)

## Outputs

Results are written to `tests/k6/results/`:

- `smoke-summary.json`, `smoke-summary.md`, `smoke-raw.json`
- `multi-user-summary.json`, `multi-user-summary.md`, `multi-user-raw.json`

## Notes on expected contention

- Circulation uses optimistic concurrency during checkout/checkin under load.
- Expected `409` contention responses in `loan_checkout` and `loan_checkin_pre` are treated as expected in k6 response callbacks so `http_req_failed` reflects true failures.
- Contention volume is still captured via custom counters (`checkout_conflicts`, `empty_copy_pools`) in `multi-user-raw.json`.



