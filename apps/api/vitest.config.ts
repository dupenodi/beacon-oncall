import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    /** Postgres + Testcontainers — use `vitest.integration.config.ts` / `npm run test:integration`. */
    exclude: ["test/integration/**"],
  },
});
