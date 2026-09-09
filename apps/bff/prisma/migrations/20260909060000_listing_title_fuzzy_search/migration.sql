-- Enables typo-tolerant title search (e.g. "Koramangala" finding a title spelled "Kormangala").
-- pg_trgm's word_similarity() measures how well a search word matches some substring of a longer
-- text, which is exactly the "does this word approximately appear in the title" question the
-- search box needs answered per word. The GIN trigram index keeps that a fast index scan instead
-- of a sequential scan with similarity() computed per row, as the table grows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Listing_title_trgm_idx" ON "Listing" USING gin (title gin_trgm_ops);
