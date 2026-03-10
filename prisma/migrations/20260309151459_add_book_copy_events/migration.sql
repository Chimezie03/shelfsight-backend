-- CreateEnum
CREATE TYPE "CopyEventType" AS ENUM ('CHECKED_OUT', 'RETURNED', 'SHELVED', 'MOVED', 'MARKED_LOST', 'MARKED_PROCESSING');

-- CreateTable
CREATE TABLE "BookCopyEvent" (
    "id" TEXT NOT NULL,
    "bookCopyId" TEXT NOT NULL,
    "type" "CopyEventType" NOT NULL,
    "userId" TEXT,
    "shelfId" TEXT,
    "loanId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookCopyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookCopyEvent_bookCopyId_createdAt_idx" ON "BookCopyEvent"("bookCopyId", "createdAt");

-- AddForeignKey
ALTER TABLE "BookCopyEvent" ADD CONSTRAINT "BookCopyEvent_bookCopyId_fkey" FOREIGN KEY ("bookCopyId") REFERENCES "BookCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
