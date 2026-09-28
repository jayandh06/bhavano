-- Requirement refinement questions — see docs/plans/requirement-refinement-questions.md
ALTER TABLE "Requirement"
  ADD COLUMN "areaIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bedroomOptions" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "minAreaSqft" INTEGER,
  ADD COLUMN "maxAreaSqft" INTEGER,
  ADD COLUMN "areaUnit" TEXT,
  ADD COLUMN "attributes" JSONB,
  ADD COLUMN "originalSearchLabel" TEXT,
  ADD COLUMN "refinedAt" TIMESTAMP(3),
  ADD COLUMN "refineNudgedAt" TIMESTAMP(3);

-- Existing rows carry their single area / bedroom count into the list columns, so every reader
-- can use the lists alone.
UPDATE "Requirement" SET "areaIds" = ARRAY["areaId"] WHERE "areaId" IS NOT NULL;
UPDATE "Requirement" SET "bedroomOptions" = ARRAY["bedrooms"] WHERE "bedrooms" IS NOT NULL;
