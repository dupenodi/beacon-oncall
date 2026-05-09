import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Placeholder table so migrations / `db:generate` have a real target (CP01 expands this). */
export const beaconMeta = pgTable("beacon_meta", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
