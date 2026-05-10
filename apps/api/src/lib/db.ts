import { createDb, type BeaconDb } from "@beacon/db";
import type postgres from "postgres";

let cached: { db: BeaconDb; client: ReturnType<typeof postgres> } | null = null;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!cached) {
    cached = createDb(url);
  }
  return cached;
}
