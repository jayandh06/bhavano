-- SavedSearch: multi-area (up to MAX_REQUIREMENT_AREAS) and bucketed bedrooms (5 = "5+"),
-- replacing the single areaId/bedrooms this used to carry — same array convention already used by
-- Requirement.areaIds/bedroomOptions and SearchEvent.areaIds. See
-- docs/plans/saved-search-multi-area-and-mandatory-fields.md.
--
-- cityId/minPrice/maxPrice are untouched here on purpose: they stay nullable in the DB even though
-- the create form now requires them — see that doc for why this is a form-level rule, not a schema
-- constraint (56 existing rows include some with none of the three set, and
-- RequirementsService.alertCriteria deliberately still writes looser system-generated alerts).

ALTER TABLE "SavedSearch" ADD COLUMN "areaIds" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "SavedSearch" ADD COLUMN "bedroomOptions" INTEGER[] NOT NULL DEFAULT '{}';

-- Backfill existing rows from their old single value before it is dropped.
UPDATE "SavedSearch" SET "areaIds" = ARRAY["areaId"] WHERE "areaId" IS NOT NULL;
UPDATE "SavedSearch" SET "bedroomOptions" = ARRAY["bedrooms"] WHERE "bedrooms" IS NOT NULL;

ALTER TABLE "SavedSearch" DROP CONSTRAINT "SavedSearch_areaId_fkey";
ALTER TABLE "SavedSearch" DROP COLUMN "areaId";
ALTER TABLE "SavedSearch" DROP COLUMN "bedrooms";
