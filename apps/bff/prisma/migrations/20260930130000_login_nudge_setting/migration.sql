-- CreateTable
CREATE TABLE "LoginNudgeSetting" (
    "id" TEXT NOT NULL,
    "webOneTapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webPromptEnabled" BOOLEAN NOT NULL DEFAULT true,
    "webPromptAfterDetailViews" INTEGER NOT NULL DEFAULT 2,
    "webPromptDelaySeconds" INTEGER NOT NULL DEFAULT 10,
    "excludeAdAndSearchLanding" BOOLEAN NOT NULL DEFAULT true,
    "webPromptRolloutPercent" INTEGER NOT NULL DEFAULT 50,
    "appPromptEnabled" BOOLEAN NOT NULL DEFAULT true,
    "appPromptAfterDetailViews" INTEGER NOT NULL DEFAULT 1,
    "dismissCooldownDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginNudgeSetting_pkey" PRIMARY KEY ("id")
);
