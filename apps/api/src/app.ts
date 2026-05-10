import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDb } from "./lib/db.js";
import { authRoutes } from "./routes/auth.js";
import { internalRoutes } from "./routes/internal.js";
import { orgRoutes } from "./routes/orgs.js";
import { publicRoutes } from "./routes/public.js";
import { webhookRoutes } from "./routes/webhooks.js";

const allowedOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function createApp() {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return allowedOrigins[0];
        return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
      },
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Cookie",
        "X-Beacon-Timestamp",
        "X-Beacon-Signature",
        "X-Internal-Auth",
      ],
      credentials: true,
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
    if (!process.env.DATABASE_URL) {
      return c.json({ ok: false, reason: "DATABASE_URL not set" }, 503);
    }
    try {
      const { db } = getDb();
      await db.execute(sql`select 1 as v`);
      return c.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown error";
      return c.json({ ok: false, error: message }, 500);
    }
  });

  app.route("/public", publicRoutes);
  app.route("/internal", internalRoutes);

  const v1 = new Hono();
  v1.route("/auth", authRoutes);
  v1.route("/orgs", orgRoutes);
  v1.route("/webhooks", webhookRoutes);
  app.route("/v1", v1);

  return app;
}
