-- Mobile app sessions were stored isBot = true because the RN Android User-Agent is "okhttp/…",
-- which the bot list flags. That hid every app user from the admin Page visits default view.
UPDATE "Visit" SET "isBot" = false WHERE "deviceType" = 'mobile_app' AND "isBot" IS DISTINCT FROM false;
