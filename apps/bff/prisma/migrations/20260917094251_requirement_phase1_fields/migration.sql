-- CreateEnum
CREATE TYPE "RequirementClosedReason" AS ENUM ('fulfilled', 'withdrawn', 'expired', 'dismissed');

-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "closedReason" "RequirementClosedReason",
ADD COLUMN     "moveInBy" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "ownersNotifiedAt" TIMESTAMP(3);

-- expiresAt is NOT NULL in the schema, but adding it that way outright fails the moment any row
-- exists. Both databases are empty today, which is exactly the kind of assumption that stops
-- being true between writing a migration and running it — so add it nullable, backfill from
-- createdAt with the same 30-day life new rows get, then tighten. Costs nothing and cannot fail.
ALTER TABLE "Requirement" ADD COLUMN "expiresAt" TIMESTAMP(3);
UPDATE "Requirement" SET "expiresAt" = "createdAt" + interval '30 days' WHERE "expiresAt" IS NULL;
ALTER TABLE "Requirement" ALTER COLUMN "expiresAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Requirement_expiresAt_idx" ON "Requirement"("expiresAt");
