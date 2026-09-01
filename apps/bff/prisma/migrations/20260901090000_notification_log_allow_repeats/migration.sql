-- ListingNotificationLog was unique on (listingId, kind), which only ever allowed one row per
-- listing per notification kind, ever. That fits the one-shot kinds it was originally built for
-- (expiry_reminder_7d, expiry_reminder_1d) but breaks a recurring one: "liked" fires once per
-- person who likes a boosted listing, potentially many times over a listing's life, and the
-- second such insert would violate this constraint.
--
-- Dropped in favour of a plain index. The expiry-reminder job's existing query
-- (`notificationLogs: { none: { kind } }`) is unaffected — it checks for the *absence* of a
-- matching row before sending, which needs no DB-level uniqueness to work correctly. The
-- constraint was only ever a safety net against a concurrent double-insert race, which the job's
-- own `running` guard already mostly prevents; losing it costs an extra harmless log row in the
-- rare case, never a duplicate send.
DROP INDEX "ListingNotificationLog_listingId_kind_key";

CREATE INDEX "ListingNotificationLog_listingId_kind_idx" ON "ListingNotificationLog"("listingId", "kind");
