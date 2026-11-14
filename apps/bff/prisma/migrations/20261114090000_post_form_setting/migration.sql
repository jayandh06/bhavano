-- CreateTable
CREATE TABLE "PostFormSetting" (
    "id" TEXT NOT NULL,
    "v2Percent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostFormSetting_pkey" PRIMARY KEY ("id")
);

-- The rollout was switched on at 50% through the POST_FORM_V2_PERCENT environment variable on 2026-11-14. This table replaces that
-- variable, so carry the live value over: without this row the share would fall back to 0 the moment the new code is deployed.
INSERT INTO "PostFormSetting" ("id", "v2Percent", "updatedAt") VALUES ('singleton', 50, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
