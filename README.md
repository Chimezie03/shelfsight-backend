# shelfsight-backend

## Installation & Setup

### Prerequisites
- Node.js v20.x or higher
- Docker Desktop (for PostgreSQL) or local PostgreSQL v14+
- npm (comes with Node.js)

### 1. Clone the repository
```sh
git clone https://github.com/Chimezie03/shelfsight-backend.git
cd shelfsight-backend
```

### 2. Install dependencies
```sh
npm install
```

### 3. Configure environment variables
Copy `.env.example` to `.env` and fill in required values:
```sh
cp .env.example .env
```
Set your `DATABASE_URL` for PostgreSQL and any AWS/OpenAI keys as needed.

### 4. Start PostgreSQL database
#### Option A: Docker
```sh
docker-compose up -d
```
#### Option B: Local PostgreSQL
Ensure PostgreSQL is running and matches your `.env` config.

### 5. Set up Prisma
```sh
npm run db:generate
npm run db:migrate
```

### 6. Seed the database
```sh
npm run db:seed
```

### 7. Start the development server
```sh
npm run dev
```

### 8. Test authentication endpoints
- POST `/auth/login` with admin credentials from seed (`admin@shelfsight.com` / `password123`)
- GET `/auth/me` with JWT from login

---
For troubleshooting, see error messages in the terminal or ask for help in the project chat.

## Supabase Runbook (Team)

Use this flow for reliable setup when running against Supabase free tier.

### 1. Configure .env
Set these values in `.env`:

```sh
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

Notes:
- Use the exact URI values from Supabase Project Settings > Database > Connection string.
- Do not use the `db.<project-ref>.supabase.co` host on networks that do not support IPv6.

### 2. Apply schema
Preferred:

```sh
npx prisma migrate deploy
```

If migration over 5432 is blocked on your network, apply migration SQL directly in Supabase SQL Editor in this order:
1. `prisma/migrations/20260223230904_init/migration.sql`
2. `prisma/migrations/20260309151459_add_book_copy_events/migration.sql`

### 3. Seed data
Run:

```sh
npx prisma db seed
```

Expected outcome includes a final line similar to:

```text
Seeding complete. Created 42 loans.
```

### 4. Verify seed counts (optional)

```sh
npx tsx -e "import { PrismaClient } from '@prisma/client'; const p=new PrismaClient(); const m=async()=>{const [users,books,copies,loans,shelves,events]=await Promise.all([p.user.count(),p.book.count(),p.bookCopy.count(),p.loan.count(),p.shelfSection.count(),p.bookCopyEvent.count()]); console.log({users,books,copies,loans,shelves,events}); await p.$disconnect();}; m();"
```