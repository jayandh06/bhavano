import path from "node:path";

/** Seeded in apps/bff/prisma/seed.ts as the demo listing owner — the only user the
 * BFF's dev-login endpoint is expected to find locally. */
export const DEMO_USER_PHONE = "9999999999";

export const BFF_URL = process.env.SMOKE_BFF_URL ?? "http://localhost:4000";

export const STORAGE_STATE_PATH = path.join(__dirname, "..", ".auth", "user.json");
