# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShelfSight backend — Express.js REST API serving the ShelfSight library management frontend. The frontend lives alongside in `shelfsight-frontend/` (separate git repo).

## Development Commands

```bash
npm run dev           # tsx watch src/index.ts (hot reload)
npm run build         # tsc → dist/
npm run start         # node dist/index.js

npm run db:generate   # Generate Prisma client from schema
npm run db:migrate    # Run Prisma migrations (prisma migrate dev)
npm run db:seed       # Seed database with test data
npm run db:studio     # Open Prisma Studio on port 5555
```

### Database

```bash
docker compose up -d   # Start PostgreSQL 16 on port 5432
```

Connection: `postgresql://shelfsight:shelfsight@localhost:5432/shelfsight`

Copy `.env.example` to `.env` before first run. Required: `DATABASE_URL`, `JWT_SECRET`. Optional: AWS keys (S3/SQS/Textract), `OPENAI_API_KEY` (Dewey classification).

## Architecture

Layered pattern with strict separation:

```
src/
├── index.ts              # Entry point (starts server)
├── app.ts                # Express setup, middleware stack, global error handler
├── routes/               # Route definitions (thin — delegate to controllers)
│   └── index.ts          # Aggregates all route modules
├── controllers/          # Request parsing, response formatting
├── services/             # Business logic, Prisma queries
├── middleware/
│   └── auth.middleware.ts # requireAuth (JWT validation), requireRole (RBAC)
├── lib/
│   └── prisma.ts         # Prisma client singleton
└── lambdas/              # AWS Lambda handlers (Textract processing)
```

**Request flow:** Route → Controller → Service → Prisma → PostgreSQL

### Authentication & Authorization

- JWT issued on login, stored in HttpOnly cookie (`token`)
- `requireAuth` middleware validates JWT from cookie on protected routes
- `requireRole('ADMIN')` middleware restricts endpoints by role
- CORS configured for `localhost:3000` (frontend)

### Data Model (Prisma)

Schema at `prisma/schema.prisma`. Key models:

- **User** — email, passwordHash, role (ADMIN | STAFF | PATRON)
- **Book** — title, author, isbn (unique), genre, deweyDecimal, coverImageUrl
- **BookCopy** — barcode (unique), status (AVAILABLE | CHECKED_OUT | LOST | DAMAGED), linked to Book and optional ShelfSection
- **Loan** — userId, bookCopyId, checkedOutAt, dueDate, returnedAt, fineAmount
- **ShelfSection** — label, mapX/mapY/width/height coordinates for 2D library map
- **IngestionJob** — imageUrl, status, extractedData (JSON) for AI book ingestion pipeline
- **BookCopyEvent** — audit log for copy status changes

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/login` | No | Authenticate, sets HttpOnly JWT cookie |
| `POST` | `/auth/logout` | No | Clears JWT cookie |
| `GET` | `/auth/me` | Yes | Current user from JWT |
| `GET` | `/books` | Yes | Search/filter (query: `search`, `genre`, `page`, `limit`) |
| `POST` | `/books` | Yes | Create book |
| `PUT` | `/books/:id` | Yes | Update book |
| `DELETE` | `/books/:id` | Yes | Delete book |
| `GET` | `/users` | Admin | List users |
| `POST` | `/users` | Admin | Create user |
| `PUT` | `/users/:id` | Admin | Update user |
| `DELETE` | `/users/:id` | Admin | Delete user |
| `GET` | `/loans` | Yes | List loans (query: `status`, `userId`, `page`, `limit`) |
| `POST` | `/loans/checkout` | Yes | Check out a book copy |
| `POST` | `/loans/checkin` | Yes | Return a book copy, calculate fines |
| `POST` | `/ingest/analyze` | Yes | Upload image → AI metadata extraction |
| `GET` | `/map/sections` | Yes | 2D map shelf coordinates |
| `GET` | `/map/shelves/:id` | Yes | Shelf contents for viewer |

## External Integrations

- **AWS S3** — book cover image storage
- **AWS SQS** — async job queue for ingestion pipeline
- **AWS Textract** — OCR text extraction from book cover/spine images
- **OpenAI API** — Dewey Decimal classification from extracted text (model configurable via `OPENAI_MODEL`, defaults to `gpt-4o`)

These are optional — the app runs without them but the AI ingestion feature requires AWS + OpenAI keys.

## Seed Data

Password for all seeded users: `password123`
- `admin@shelfsight.com` (ADMIN), `staff@shelfsight.com` (STAFF), `patron@shelfsight.com` (PATRON)
- 16 books with copies, shelf assignments, and active/overdue loans
