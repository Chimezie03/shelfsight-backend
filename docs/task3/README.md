# Task 3 - Load Testing and Multi-User Testing (k6)

This folder documents Task 3 deliverables for ShelfSight (k6 scenarios, concurrent workflow coverage, measured performance, and current system limits)

## A. Scope and flows

Covered backend workflows:

- Auth: login, session check, logout
- Catalog: search, filter, detail
- Circulation: loan list, checkout, checkin
- Ingestion: job list, ISBN lookup, analyze upload, job detail/reject

## B. Test setup

| Item | Value |
|------|-------|
| Repo | `shelfsight-backend` |
| Base URL | `http://localhost:3001` |
| Tool | k6 (`grafana/k6:0.49.0` if local k6 is unavailable) |
| Seed credentials | default seed users, password `password123` |
| Data state | users: `16`, books: `50`, copies: `100`, loans: `132` |

## C. Scenarios implemented

### Smoke suite

- File: `tests/k6/scenarios/smoke.js`
- Purpose: fast validation of core auth/catalog/circulation behavior
- Profile: single VU, 5 iterations

### Multi-user suite

- File: `tests/k6/scenarios/multi-user.js`
- Profile: `task3` (2 minutes)
- Peak concurrent VUs: 45

| Scenario | Max VUs | Covered endpoints |
|----------|---------|-------------------|
| `auth_flow` | 10 | `/auth/login`, `/auth/me`, `/auth/logout` |
| `catalog_flow` | 20 | `/books` search/filter/detail |
| `circulation_flow` | 10 | `/loans`, `/loans/checkout`, `/loans/checkin` |
| `ingestion_flow` | 5 | `/ingest/jobs`, `/ingest/lookup`, `/ingest/analyze`, `/ingest/jobs/:id` |

## D. Results summary

### Smoke

| Metric | Value |
|--------|-------|
| Iterations | 5 |
| HTTP p95 | 258.06 ms |
| HTTP avg | 63.12 ms |
| HTTP failure rate | 0.00% |
| Checks pass rate | 100% |

### Multi-user

| Metric | Value |
|--------|-------|
| Iterations | 3531 |
| HTTP requests | 9453 |
| Peak VUs | 45 |
| HTTP p90 | 184.13 ms |
| HTTP p95 | 279.74 ms |
| HTTP avg | 55.50 ms |
| Max request latency | 1223.93 ms |
| HTTP failure rate | 0.00% |
| Checks pass rate | 100% (14602/14602) |

### Per-flow request latency (p95)

| Flow | p95 |
|------|-----|
| Auth | 362.89 ms |
| Catalog | 267.52 ms |
| Circulation | 265.45 ms |
| Ingestion | 258.63 ms |

### End-to-end flow latency (p95)

| Flow | p95 |
|------|-----|
| Auth flow | 691.60 ms |
| Catalog flow | 565.70 ms |
| Circulation flow | 831.40 ms |
| Ingestion flow | 1226.90 ms |

### Threshold status

All configured thresholds passed:

- Global HTTP error rate threshold
- Global check pass-rate threshold
- Scenario-level request latency thresholds
- Flow-duration latency thresholds

## E. Bottlenecks and current limits

- Ingestion remains the slowest end-to-end path (`ingestion_flow_duration p95 = 1226.90 ms`).
- Circulation showed minor contention (`checkout_conflicts = 3`).
- Circulation also showed inventory skew during concurrent paging (`empty_copy_pools = 239`).
- Load harness update: expected circulation contention responses (`409`) are now explicitly treated as expected for `loan_checkout` and `loan_checkin_pre`; contention is tracked through counters instead of inflating failure rate.
- Catalog and auth remained stable under peak concurrent load.

Validated limit from this run:

- 45 concurrent VUs across 4 workflows for 2 minutes
- 9.4k+ HTTP requests with zero HTTP failures and full checks pass

These limits are for the current seeded dataset (~50 books / 100 copies). Revalidation is required after Task 1 large-scale data population.

## F. Recommendations

1. Re-run the same suite at 10k+ and 100k dataset milestones.
2. Increase available-copy pool for circulation scenarios to reduce data-contention noise.
3. Track ingestion p95/p99 in CI as a release-health signal.
4. Add a longer soak profile (10-15 minutes) to detect gradual degradation.

## G. Artifacts

- Test harness: `tests/k6/`
- Summaries:
  - `tests/k6/results/smoke-summary.json`
  - `tests/k6/results/multi-user-summary.json`
  - `tests/k6/results/smoke-summary.md`
  - `tests/k6/results/multi-user-summary.md`
- Raw outputs:
  - `tests/k6/results/smoke-raw.json`
  - `tests/k6/results/multi-user-raw.json`
