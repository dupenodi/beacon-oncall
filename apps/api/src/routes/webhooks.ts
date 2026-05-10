import { Hono } from "hono";
import { getDb } from "../lib/db";
import { createNotifier } from "../services/notify";
import { ingestSignedWebhook } from "../services/webhook";

export const webhookRoutes = new Hono();

webhookRoutes.post("/:orgSlug/ingest", async (c) => {
  const rawBody = new Uint8Array(await c.req.arrayBuffer());
  const orgSlug = c.req.param("orgSlug");
  const { db } = getDb();
  const result = await ingestSignedWebhook(db, {
    orgSlug,
    rawBody,
    timestampHeader: c.req.header("X-Beacon-Timestamp"),
    signatureHeader: c.req.header("X-Beacon-Signature"),
    notifier: createNotifier(),
  });

  if (!result.ok) {
    const { status, code, message } = result.error;
    return c.json({ error: { code, message } }, status as 400 | 401 | 404 | 503);
  }

  if (result.deduped) {
    return c.json({ incidentId: result.incidentId, deduped: true });
  }
  return c.json({ incidentId: result.incidentId });
});
