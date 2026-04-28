# Task 4 - Load Testing & Performance (k6)

This folder documents Task 4 deliverables for ShelfSight (post-scaling re-tests, heavier concurrency runs, performance comparison, and stability findings).

## A. Scope and objective

Covered backend workflows:

- Auth: login, session check, logout
- Catalog: search, filter, detail
- Circulation: loan list, checkout, checkin
- Ingestion: job list, ISBN lookup, analyze upload, job detail/reject

Task objective:

- Re-run the multi-user suite after DB/data scaling.
- Increase concurrency beyond the original 45-user baseline.
- Compare p95 latency and failure rates across load levels.
- Identify bottlenecks and confirm functional stability under heavier load.

## B. Test setup

| Item                    | Value                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Repo                    | `shelfsight-backend`                                                             |
| Base URL                | `http://localhost:3001`                                                          |
| Tool                    | k6 (local `k6.exe v1.7.1`)                                                       |
| Seed credentials        | default seed users, password `password123`                                       |
| Data state before scale | users:`16`, books: `50`, copies: `100`, loans: `3289`, jobs: `1448`      |
| Data state after scale  | users:`16`, books: `10050`, copies: `35096`, loans: `3289`, jobs: `1448` |

## C. Scenarios implemented

### Multi-user suite

- File: `tests/k6/scenarios/multi-user.js`
- Baseline profile re-run on scaled data: `task3` (2 minutes)
- Added Task 4 heavier profiles: `task4_90`, `task4_135`

| Scenario                 | Max VUs (`task3`) | Max VUs (`task4_90`) | Max VUs (`task4_135`) | Covered endpoints                                                               |
| ------------------------ | ------------------- | ---------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| `auth_flow`            | 10                  | 20                     | 30                      | `/auth/login`, `/auth/me`, `/auth/logout`                                 |
| `catalog_flow`         | 20                  | 40                     | 60                      | `/books` search/filter/detail                                                 |
| `circulation_flow`     | 10                  | 20                     | 30                      | `/loans`, `/loans/checkout`, `/loans/checkin`                             |
| `ingestion_flow`       | 5                   | 10                     | 15                      | `/ingest/jobs`, `/ingest/lookup`, `/ingest/analyze`, `/ingest/jobs/:id` |
| **Total peak VUs** | **45**        | **90**           | **135**           | -                                                                               |

## D. Results summary

### Overall comparison

| Run                                                     | Peak VUs | HTTP p95    | HTTP avg   | HTTP max    | HTTP failure rate | Checks pass rate | Iterations |
| ------------------------------------------------------- | -------- | ----------- | ---------- | ----------- | ----------------- | ---------------- | ---------- |
| Historical baseline (Task 3, April 21, 2026, pre-scale) | 45       | 279.74 ms   | 55.50 ms   | 1223.93 ms  | 0.00%             | 100%             | 3531       |
| Re-run baseline profile on scaled data (`task3`)      | 45       | 3152.70 ms  | 1095.03 ms | 7230.09 ms  | 0.00%             | 100%             | 764        |
| Heavy load (`task4_90`)                               | 90       | 7974.10 ms  | 3266.23 ms | 25294.97 ms | 0.00%             | 100%             | 610        |
| Stress load (`task4_135`)                             | 135      | 16019.52 ms | 6307.59 ms | 44489.27 ms | 0.00%             | 100%             | 464        |

### Per-flow request latency (p95)

| Flow        | 45 VUs scaled | 90 VUs      | 135 VUs     |
| ----------- | ------------- | ----------- | ----------- |
| Auth        | 2517.53 ms    | 10301.54 ms | 20142.68 ms |
| Catalog     | 3268.05 ms    | 6852.18 ms  | 11420.02 ms |
| Circulation | 3020.39 ms    | 7211.23 ms  | 13838.59 ms |
| Ingestion   | 3193.27 ms    | 19150.63 ms | 35862.71 ms |

### End-to-end flow latency (p95)

| Flow             | 45 VUs scaled | 90 VUs      | 135 VUs     |
| ---------------- | ------------- | ----------- | ----------- |
| Auth flow        | 4788.80 ms    | 17183.50 ms | 31840.10 ms |
| Catalog flow     | 5123.60 ms    | 12198.30 ms | 25713.10 ms |
| Circulation flow | 11194.00 ms   | 32286.10 ms | 56339.65 ms |
| Ingestion flow   | 11838.70 ms   | 47720.20 ms | 77945.20 ms |

### Threshold status

All post-scale Task 4 runs crossed configured latency thresholds:

- Re-run baseline on scaled data (`task3`, 45 VUs): threshold failures
- Heavy load (`task4_90`, 90 VUs): threshold failures
- Stress load (`task4_135`, 135 VUs): threshold failures

Failure-rate and checks thresholds remained stable:

- `http_req_failed`: `0.00%` for all post-scale runs
- `checks` pass rate: `100%` for all post-scale runs

## E. Bottlenecks and stability findings

- Primary bottleneck: ingestion path under concurrency, especially `ingest/lookup` + analyze flow.
- Secondary bottlenecks at high load: auth login path and circulation flow duration.
- Contention remained controlled and expected:
  - `checkout_conflicts = 3` (45 VUs scaled)
  - `checkout_conflicts = 11` (90 VUs)
  - `checkout_conflicts = 4` (135 VUs)
- Stability conclusion: functionally stable (no HTTP failures) but latency SLOs were not sustained after scaling and concurrency increase.

## F. Recommendations

1. Optimize ingestion path first; it dominates p95 regressions at 90/135 VUs.
2. Add endpoint-level timing telemetry for `/auth/login`, `/books`, `/loans`, and `/ingest/*` to isolate DB vs dependency wait.
3. Consider separating ingestion load profile from core API throughput profile to reduce mixed-signal variance.
4. Re-run these same Task 4 profiles after optimizations for an apples-to-apples recovery comparison.

## G. Artifacts

- Test harness: `tests/k6/`
- Task 4 summaries:
  - `tests/k6/results/task4/multi-user-45vu-summary.json`
  - `tests/k6/results/task4/multi-user-90vu-summary.json`
  - `tests/k6/results/task4/multi-user-135vu-summary.json`
  - `tests/k6/results/task4/multi-user-45vu-summary.md`
  - `tests/k6/results/task4/multi-user-90vu-summary.md`
  - `tests/k6/results/task4/multi-user-135vu-summary.md`
- Task 4 raw outputs:
  - `tests/k6/results/task4/multi-user-45vu-raw.json`
  - `tests/k6/results/task4/multi-user-90vu-raw.json`
  - `tests/k6/results/task4/multi-user-135vu-raw.json`
