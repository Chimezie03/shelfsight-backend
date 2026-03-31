-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IngestionStatus" ADD VALUE 'APPROVED';
ALTER TYPE "IngestionStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "IngestionJob" ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "createdBookId" TEXT,
ADD COLUMN     "deweyReasoning" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "metadataSource" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "suggestedAuthor" TEXT,
ADD COLUMN     "suggestedGenre" TEXT,
ADD COLUMN     "suggestedPublishDate" TEXT,
ADD COLUMN     "suggestedPublisher" TEXT,
ADD COLUMN     "suggestedTitle" TEXT;

-- AlterTable
ALTER TABLE "ShelfSection" ADD COLUMN     "capacityPerTier" INTEGER DEFAULT 30,
ADD COLUMN     "category" TEXT DEFAULT 'Uncategorized',
ADD COLUMN     "color" TEXT DEFAULT '#1B2A4A',
ADD COLUMN     "deweyRangeEnd" TEXT,
ADD COLUMN     "deweyRangeStart" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "numberOfTiers" INTEGER DEFAULT 4,
ADD COLUMN     "rotation" INTEGER DEFAULT 0,
ADD COLUMN     "sectionCode" TEXT,
ADD COLUMN     "shelfType" TEXT DEFAULT 'single-shelf';
