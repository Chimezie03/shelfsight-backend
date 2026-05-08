-- AlterTable
ALTER TABLE "BookCopy" ADD COLUMN "shelfSlot" INTEGER;

-- AlterTable
ALTER TABLE "ShelfSection" ADD COLUMN "tierCapacities" JSONB;
