-- Records the visitor's IP alongside the source/medium already captured per session, so traffic
-- can be attributed geographically and abuse traced to an origin. Nullable: a request without a
-- usable X-Forwarded-For should still record its visit rather than fail.
ALTER TABLE "Visit" ADD COLUMN "ip" TEXT;
