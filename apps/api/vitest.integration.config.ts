import { defineConfig } from "vitest/config";

/** Postgres + Testcontainers — run via `npm run test:integration -w @beacon/api` (Docker required). */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
