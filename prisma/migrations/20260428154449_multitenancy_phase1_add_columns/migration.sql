-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "BookCopy" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Fine" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "IngestionJob" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ShelfSection" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "TransactionLog" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_organizationId_createdAt_idx" ON "Invite"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");

-- CreateIndex
CREATE INDEX "Book_organizationId_idx" ON "Book"("organizationId");

-- CreateIndex
CREATE INDEX "BookCopy_organizationId_idx" ON "BookCopy"("organizationId");

-- CreateIndex
CREATE INDEX "Fine_organizationId_idx" ON "Fine"("organizationId");

-- CreateIndex
CREATE INDEX "IngestionJob_organizationId_idx" ON "IngestionJob"("organizationId");

-- CreateIndex
CREATE INDEX "Loan_organizationId_idx" ON "Loan"("organizationId");

-- CreateIndex
CREATE INDEX "ShelfSection_organizationId_idx" ON "ShelfSection"("organizationId");

-- CreateIndex
CREATE INDEX "TransactionLog_organizationId_idx" ON "TransactionLog"("organizationId");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfSection" ADD CONSTRAINT "ShelfSection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Book_author_trgm_idx" RENAME TO "Book_author_idx";

-- RenameIndex
ALTER INDEX "Book_title_trgm_idx" RENAME TO "Book_title_idx";

-- RenameIndex
ALTER INDEX "TransactionLog_bookTitle_trgm_idx" RENAME TO "TransactionLog_bookTitle_idx";

-- RenameIndex
ALTER INDEX "TransactionLog_memberName_trgm_idx" RENAME TO "TransactionLog_memberName_idx";

-- RenameIndex
ALTER INDEX "User_name_trgm_idx" RENAME TO "User_name_idx";

-- Backfill: create default organization for all pre-existing data ----------
-- Fixed UUID so subsequent migrations / seeds can reference it deterministically.
INSERT INTO "Organization" ("id", "name", "slug", "createdAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'ShelfSight Library', 'shelfsight-library', NOW())
ON CONFLICT ("id") DO NOTHING;

UPDATE "User"           SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Book"           SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "BookCopy"       SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Loan"           SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Fine"           SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "TransactionLog" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ShelfSection"   SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "IngestionJob"   SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
