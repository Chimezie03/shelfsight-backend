# Scalability findings (Task 5)

## 1. Catalog list loads full collection then filters in memory

| Field | Detail |
|-------|--------|
| **Confirmed vs likely** | **Likely** (strong code review); **confirmed** pattern in `fetchBooks` implementation |
| **Evidence** | `books.service.ts` uses `findMany` with `include: { copies: { include: { shelf: true } } }` **without** `skip`/`take` on the query, then applies category/status/year filters and pagination in JavaScript (`filtered.slice`). |
| **Impact** | Memory and CPU grow with total catalog size; DB and network transfer scale with **all** books, not page size. |
| **Recommended fix** | Push filters/sort/pagination into Prisma `where`/`orderBy`/`skip`/`take` where possible; add DB indexes for common filters (`title`, `author`, `isbn`, `genre`, `language`, `createdAt`). |
| **Implemented now?** | **No** (out of scope for Task 5 product work; documented for backlog). |

## 2. Readiness probe hits database on every request

| Field | Detail |
|-------|--------|
| **Confirmed vs likely** | **Likely** |
| **Evidence** | `GET /health/ready` runs `SELECT 1` via Prisma each request. |
| **Impact** | Under extreme probe frequency, adds DB connection pressure. |
| **Recommended fix** | Use `/health` for liveness; rate-limit readiness checks; optional short in-process cache (e.g. 1s) if platform allows. |
| **Implemented now?** | **No** (documentation only). |

## 3. N+1 patterns in other endpoints

| Field | Detail |
|-------|--------|
| **Confirmed vs likely** | **Likely** (spot-check) |
| **Evidence** | Services using `include` with nested relations should be reviewed per endpoint under load. |
| **Impact** | Extra queries per request as features grow. |
| **Recommended fix** | Use Prisma `include`/`select` deliberately; add `@@index` in schema for foreign keys used in filters. |
| **Implemented now?** | **No** |

## Baseline load (test evidence)

See [README.md](./README.md) — `/health` sustained high throughput on local dev server; DB-bound routes vary with environment.
