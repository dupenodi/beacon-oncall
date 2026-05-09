import { serve } from "@hono/node-server";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "@beacon/db";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "beacon-api",
    time: new Date().toISOString(),
  }),
);

app.get("/health/db", async (c) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return c.json({ ok: false, reason: "DATABASE_URL not set" }, 503);
  }
  try {
    const { db, client } = createDb(url);
    await db.execute(sql`select 1 as v`);
    await client.end({ timeout: 1 });
    return c.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return c.json({ ok: false, error: message }, 500);
  }
});

const port = Number(process.env.API_PORT ?? "3001");

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`beacon api listening on http://localhost:${info.port}`);
});
