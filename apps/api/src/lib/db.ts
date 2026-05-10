import { createDb, type BeaconDb } from "@beacon/db";
import type postgres from "postgres";

export type DbBundle = { db: BeaconDb; client: ReturnType<typeof postgres> };

let cached: DbBundle | undefined;

export function getDb(): DbBundle {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (cached === undefined) {
    cached = createDb(url);
  }
  return cached;
}
