-- Enable trigram extension for efficient ILIKE / contains searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes on Book text-search columns
CREATE INDEX IF NOT EXISTS "Book_title_trgm_idx"  ON "Book" USING GIN ("title"  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Book_author_trgm_idx" ON "Book" USING GIN ("author" gin_trgm_ops);

-- B-tree index on Book.genre for exact-match genre filtering
CREATE INDEX IF NOT EXISTS "Book_genre_idx" ON "Book"("genre");

-- GIN trigram index on User.name for loan / fine search
CREATE INDEX IF NOT EXISTS "User_name_trgm_idx" ON "User" USING GIN ("name" gin_trgm_ops);

-- GIN trigram indexes on TransactionLog search columns
CREATE INDEX IF NOT EXISTS "TransactionLog_bookTitle_trgm_idx"   ON "TransactionLog" USING GIN ("bookTitle"   gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "TransactionLog_memberName_trgm_idx"  ON "TransactionLog" USING GIN ("memberName"  gin_trgm_ops);

-- B-tree index on ShelfSection.floor for ordering
CREATE INDEX IF NOT EXISTS "ShelfSection_floor_idx" ON "ShelfSection"("floor");
