# Task 1: Bulk Upload & Large-Scale Data Population

## Overview
This task implements a highly scalable approach to ingest and populate books in the ShelfSight application, both computationally offline via direct database load and interactively through an administrative HTTP endpoint. 

## Approach

### 1. `POST /books/bulk` Admin Endpoint
We introduced a new bulk processing workflow to `src/controllers/books.controller.ts` and `src/services/books.service.ts`:
- **Function**: Accepts JSON arrays of up to 500 books at once for parsing and validation.
- **Validation**: Strict ISBN 10/13 checks, validation of required authors/titles.
- **Duplicate Handling**: If a book's ISBN already exists in the catalog, the workflow performs an `upsert` operation. It preserves original copy records while automatically mapping new copies and updating book metadata gracefully.
- **Transaction Safety**: Processes items independently inside the array or grouped via sub-batch transactions so that a single corrupted record doesn't trigger an out-of-memory exception or roll back the entire valid subset of data.

### 2. Large-Scale Realistic Database Population Script
To scale towards ~100k records quickly for testing scalability in search and checkout, we created the `scripts/populate-db.ts` script.
- **Mechanism**: Utilizes `@faker-js/faker` to instantiate realistic book metadata. It auto-generates titles, fake ISBN-13 checksums, Dewey classifications, and UUID relationships for the `BookCopy` table.
- **Execution Strategy**: Employs Prisma's `createMany` with `skipDuplicates: true` batch insertion across partitioned groups of items (e.g. `BATCH_SIZE = 2500`).
- **Running the Population Script**:
  \`\`\`bash
  cd shelfsight-backend
  npm i
  TOTAL_BOOKS=25000 npx tsx scripts/populate-db.ts
  \`\`\`

## Limitations
- **External API Throttling**: If bulk loading books that require metadata enrichment via AWS/Textract/LLM, this script explicitly omits invoking rate-limited AWS APIs and relies on randomized internal data generation.
- **Prisma Limits**: Trying to push >10,000 entities in a single `createMany` batch risks running out of RAM in Node or breaching Postgres payload limits. The offline `populate-db.ts` segments into 2,500 item chunks safely.
- **Data Veracity**: We use faker instead of OpenLibrary data arrays intentionally to prevent downloading hundreds of megabytes and parse delays during early architecture benchmarking. 

## Core Flows Validation
These operations efficiently bypass and populate `schema.prisma` correctly, meaning:
- **Catalog Flow**: Data lands correctly.
- **Circulation/Loans Flow**: `AVAILABLE` `BookCopy` records are generated correctly with unique barcodes.
- **Search (Task 5 prep)**: The sheer volume properly exercises `@@index` setups.