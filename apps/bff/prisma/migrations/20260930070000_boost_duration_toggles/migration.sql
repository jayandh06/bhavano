-- Admin → Plans can switch each boost duration off in the pickers. All stay on by default.
ALTER TABLE "BoostPriceSetting"
  ADD COLUMN "boost7dEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "boost15dEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "boost30dEnabled" BOOLEAN NOT NULL DEFAULT true;
