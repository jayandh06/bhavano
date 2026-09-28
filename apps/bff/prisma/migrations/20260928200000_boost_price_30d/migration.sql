-- AlterTable: the 30-day boost. Defaults are the live prices (property/coworking-PG-storage 299,
-- furniture-interiors 149), so the existing singleton row starts on them.
ALTER TABLE "BoostPriceSetting"
  ADD COLUMN "propertyBoostPrice30d" INTEGER NOT NULL DEFAULT 299,
  ADD COLUMN "coworkingPgStorageBoostPrice30d" INTEGER NOT NULL DEFAULT 299,
  ADD COLUMN "furnitureInteriorsBoostPrice30d" INTEGER NOT NULL DEFAULT 149;
