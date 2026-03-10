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
- POST `/auth/login` with admin credentials from seed (`admin@shelfsight.com` / `adminpassword`)
- GET `/auth/me` with JWT from login

---
For troubleshooting, see error messages in the terminal or ask for help in the project chat.