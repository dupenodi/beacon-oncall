import { createDb, type BeaconDb } from "@beacon/db";
import type postgres from "postgres";

export type DbBundle = { db: BeaconDb; client: ReturnType<typeof postgres> };

let cached: DbBundle | undefined;

export function getDb(): DbBundle {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const bundle = cached ?? createDb(url);
  cached = bundle;
  return bundle;
}
