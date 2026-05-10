import crypto from "node:crypto";
import { Hono } from "hono";
import { getDb } from "../lib/db.js";
import { processTickBatch } from "../services/escalation.js";
import { createNotifier } from "../services/notify.js";

function timingSafeAuth(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const internalRoutes = new Hono();

internalRoutes.post("/tick", async (c) => {
  const secret = process.env.INTERNAL_TICK_SECRET;
  if (!secret || secret.length < 32) {
    return c.json(
      { error: { code: "server_misconfigured", message: "INTERNAL_TICK_SECRET must be set (min 32 chars)" } },
      503,
    );
  }

  const hdr = c.req.header("X-Internal-Auth") ?? "";
  if (!timingSafeAuth(hdr, secret)) {
    return c.json({ error: { code: "unauthorized", message: "Invalid internal auth" } }, 401);
  }

  const limit = Number(c.req.query("limit"));
  const { db } = getDb();
  const result = await processTickBatch(db, createNotifier(), Number.isFinite(limit) ? limit : 50);
  return c.json(result);
});
