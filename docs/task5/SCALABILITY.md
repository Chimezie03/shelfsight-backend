# Scalability findings & optimizations (Task 5)

## Implemented optimizations (Task 5 sprint)

### 1. GIN trigram indexes for text search

Added `pg_trgm` extension and GIN indexes on high-cardinality text columns used for `LIKE`/`ILIKE` search:

| Column | Index |
|--------|-------|
| `Book.title` | GIN (`gin_trgm_ops`) |
| `Book.author` | GIN (`gin_trgm_ops`) |
| `Book.genre` | B-tree |
| `User.name` | GIN (`gin_trgm_ops`) |
| `TransactionLog.bookTitle` | GIN (`gin_trgm_ops`) |
| `TransactionLog.memberName` | GIN (`gin_trgm_ops`) |
| `ShelfSection.floor` | B-tree |

Migration: `prisma/migrations/20260420000000_add_search_indexes/migration.sql`

### 2. Users endpoint: server-side pagination

`GET /users` now accepts `page`/`limit` (max 100) and returns `{ data, pagination }`. All frontend call sites updated.

### 3. Books status filter pushed to SQL

`status=available|checked-out|maintenance` is now translated to Prisma `copies.some/none` WHERE clauses, eliminating in-memory filtering over the full catalog.

### 4. Auth over-fetch removed

`/auth/me` no longer joins `loans → bookCopy → book` on every request; returns only user identity fields.

### 5. Catalog eager fetch eliminated (frontend)

Removed the on-mount `limit=9999` catalog fetch. Export now fetches on demand (up to 500 with current filters). Server `pagination.total` used for stats display.

### 6. Pagination limits enforced in all controllers

`MAX_LIMIT=100` applied to books, loans, fines, transactions, and users. NaN-safe `Number()` parsing prevents bypass via invalid query params.

### 7. Rate limiting (express-rate-limit)

- Global: 300 requests / 15 min per IP
- Auth (`/auth/login`): 15 requests / 15 min per IP

### 8. Dashboard & reports over-fetching reduced (frontend)

Dashboard runs all 8 fetches in a single `Promise.all`. Limits reduced from `limit=1000/500/2000` to `limit=100`.

### 9. Loans pagination: sequential → parallel (frontend)

`fetchLoans` in `use-circulation-state.ts` previously fetched pages sequentially via `do…while`. Now fetches page 1, then remaining pages in parallel with `Promise.all`.

### 10. Fines: client-side filtering → server-side (frontend)

`fetchFines` now passes `status` and debounced `search` to the backend, eliminating the `limit=500` bulk load and client-side filter logic. `pagination.total` drives page count.

### 11. Shelf sections: floor filter + safety cap

`GET /map` now accepts optional `?floor=N` query param. `listShelfSections` applies it as a Prisma `where` clause and caps results at 500 rows.

---

## Remaining known issues

### A. Catalog list loads full collection then filters in memory

| Field | Detail |
|-------|--------|
| **Confirmed vs likely** | **Confirmed** |
| **Evidence** | `books.service.ts` applies category/year filters in JavaScript after `findMany`. Status filter is now in SQL (fixed above). |
| **Impact** | Memory and CPU grow with total catalog size. |
| **Recommended fix** | Push remaining filters (year, language) into Prisma `where`; add DB indexes for `publishYear`, `language`, `createdAt`. |
| **Implemented now?** | **Partially** — status pushed to SQL; year/language remain in-memory. |

### B. Readiness probe hits database on every request

| Field | Detail |
|-------|--------|
| **Confirmed vs likely** | **Likely** |
| **Evidence** | `GET /health/ready` runs `SELECT 1` via Prisma each request. |
| **Impact** | Under extreme probe frequency, adds DB connection pressure. |
| **Recommended fix** | Rate-limit readiness checks; optional short in-process cache (e.g. 1s). |
| **Implemented now?** | **No** |

### C. N+1 patterns

| Field | Detail |
|-------|--------|
| **Confirmed vs likely** | **Likely** (spot-check) |
| **Evidence** | Services using nested `include` should be reviewed per endpoint under load. |
| **Recommended fix** | Use Prisma `select` with only required columns; add `@@index` for all FK columns used in filters. |
| **Implemented now?** | **No** |

## Baseline load (test evidence)

See [README.md](./README.md) — `/health` sustained high throughput on local dev server; DB-bound routes vary with environment.


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
