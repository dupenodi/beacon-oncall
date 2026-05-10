import { Hono } from "hono";
import { getDb } from "../lib/db.js";
import { getPublicStatus } from "../services/public-status.js";

export const publicRoutes = new Hono();

publicRoutes.get("/:orgSlug/status", async (c) => {
  const { db } = getDb();
  const data = await getPublicStatus(db, c.req.param("orgSlug"));
  if (!data) {
    return c.json({ error: { code: "not_found", message: "Unknown organization" } }, 404);
  }
  return c.json(data);
});
