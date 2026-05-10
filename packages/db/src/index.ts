import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type BeaconDb = PostgresJsDatabase<typeof schema>;

export function createDb(databaseUrl: string): { db: BeaconDb; client: ReturnType<typeof postgres> } {
  const client = postgres(databaseUrl, { max: 10 });
  const db = drizzle(client, { schema });
  return { db, client };
}

export * from "./schema";
export * from "./crypto";
