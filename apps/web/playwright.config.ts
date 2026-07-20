import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE_PATH } from "./e2e/support/constants";

// Playwright's own process doesn't load .env the way Next.js's dev server does — needed here
// so `auth.setup.ts` can read the same NEXTAUTH_SECRET the running web app uses.
dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

// Runs against already-running dev servers (`pnpm dev`, web + bff) rather than spinning up its
// own — see docs/plans/web-smoke-tests.md. No `webServer` block: Playwright's own connection
// retry/timeout surfaces a clear error if `pnpm dev` isn't already up.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A single shared dev-mode Next.js server (not a per-worker production build) is the whole
  // point here — too much worker parallelism causes React hydration-timing flakiness under the
  // contention (verified: reliable at 4, flaky at the 8-worker default). One retry absorbs the
  // rest of that environmental noise without masking a genuine, consistently-reproducing
  // regression, which fails on retry too.
  workers: 4,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE_PATH },
      dependencies: ["setup"],
    },
  ],
});
