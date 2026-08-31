import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Node environment on purpose: everything under test here is pure URL/string logic, so there is
// no DOM to simulate and no reason to pay for one.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
