-- DropForeignKey
ALTER TABLE "Book" DROP CONSTRAINT "Book_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "BookCopy" DROP CONSTRAINT "BookCopy_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Fine" DROP CONSTRAINT "Fine_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "IngestionJob" DROP CONSTRAINT "IngestionJob_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Loan" DROP CONSTRAINT "Loan_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ShelfSection" DROP CONSTRAINT "ShelfSection_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionLog" DROP CONSTRAINT "TransactionLog_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_organizationId_fkey";

-- DropIndex
DROP INDEX "Book_isbn_key";

-- DropIndex
DROP INDEX "BookCopy_barcode_key";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Book" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "BookCopy" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Fine" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "IngestionJob" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Loan" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ShelfSection" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "TransactionLog" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Book_organizationId_isbn_key" ON "Book"("organizationId", "isbn");

-- CreateIndex
CREATE UNIQUE INDEX "BookCopy_organizationId_barcode_key" ON "BookCopy"("organizationId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfSection" ADD CONSTRAINT "ShelfSection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

