-- CreateEnum
CREATE TYPE "FineStatus" AS ENUM ('UNPAID', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CHECKOUT', 'CHECKIN', 'RENEWAL', 'FINE_PAID', 'FINE_WAIVED');

-- CreateTable
CREATE TABLE "Fine" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "FineStatus" NOT NULL DEFAULT 'UNPAID',
    "reason" TEXT NOT NULL DEFAULT 'Overdue',
    "paidAt" TIMESTAMP(3),
    "waivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLog" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "loanId" TEXT,
    "bookTitle" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "processedBy" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fine_userId_status_idx" ON "Fine"("userId", "status");

-- CreateIndex
CREATE INDEX "Fine_loanId_idx" ON "Fine"("loanId");

-- CreateIndex
CREATE INDEX "Fine_createdAt_idx" ON "Fine"("createdAt");

-- CreateIndex
CREATE INDEX "TransactionLog_type_createdAt_idx" ON "TransactionLog"("type", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionLog_createdAt_idx" ON "TransactionLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
