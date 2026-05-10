import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

/**
 * Load `.env` from the monorepo root when present. Uses `import.meta.url` so it works whether
 * `process.cwd()` is the repo root (some hosts) or `apps/api` (npm workspace scripts).
 * Never overrides variables already set by the host (e.g. Render).
 */
const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  resolve(here, "../../../.env"), // apps/api/{src,dist} → repo root
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
];

for (const path of candidates) {
  if (existsSync(path)) {
    config({ path, override: false });
    break;
  }
}
