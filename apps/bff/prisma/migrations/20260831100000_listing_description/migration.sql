-- A seller's own words about the listing, distinct from `specs`.
--
-- `specs` is a short comma-split array rendered as chips in a single non-wrapping row on every
-- card ("3 Beds", "1450 sqft"); prose typed into it squashed that row, and it was doing double
-- duty as the meta/JSON-LD description for want of anywhere better. This is that better place.
--
-- Nullable rather than defaulted: every existing listing genuinely has no description, and an
-- empty string would be indistinguishable from one someone chose to leave blank.
ALTER TABLE "Listing" ADD COLUMN "description" TEXT;
