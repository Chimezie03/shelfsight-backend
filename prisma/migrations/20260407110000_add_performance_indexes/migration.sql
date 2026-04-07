-- Performance indexes for high-frequency read paths
CREATE INDEX IF NOT EXISTS "Book_createdAt_idx" ON "Book"("createdAt");
CREATE INDEX IF NOT EXISTS "Book_language_idx" ON "Book"("language");

CREATE INDEX IF NOT EXISTS "BookCopy_bookId_idx" ON "BookCopy"("bookId");
CREATE INDEX IF NOT EXISTS "BookCopy_shelfId_idx" ON "BookCopy"("shelfId");

CREATE INDEX IF NOT EXISTS "Loan_userId_checkedOutAt_idx" ON "Loan"("userId", "checkedOutAt");
CREATE INDEX IF NOT EXISTS "Loan_bookCopyId_returnedAt_idx" ON "Loan"("bookCopyId", "returnedAt");
CREATE INDEX IF NOT EXISTS "Loan_returnedAt_dueDate_idx" ON "Loan"("returnedAt", "dueDate");

CREATE INDEX IF NOT EXISTS "IngestionJob_createdAt_idx" ON "IngestionJob"("createdAt");
CREATE INDEX IF NOT EXISTS "IngestionJob_status_createdAt_idx" ON "IngestionJob"("status", "createdAt");
