-- Whether the seeker agreed that owners and agents with a matching property may contact them
-- directly. Nullable, and null means "no": every row that predates the question was captured
-- without it being asked, so treating absence as permission would be inventing consent.
ALTER TABLE "Requirement" ADD COLUMN "contactConsentAt" TIMESTAMP(3);
