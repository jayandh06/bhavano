-- Admin toggle for where the Boost/Instant Alerts picker appears: false (default) keeps today's
-- post-ad upsell-only behavior; true moves it onto the ad-preview step instead. The two
-- placements are mutually exclusive by design, never both shown at once.
ALTER TABLE "BoostPriceSetting" ADD COLUMN     "showSelectorOnPreview" BOOLEAN NOT NULL DEFAULT false;
