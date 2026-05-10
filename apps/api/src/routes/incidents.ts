import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../lib/db.js";
import { requireOrgMembership } from "../middleware/require-org.js";
import {
  approveAndExecuteGithubComment,
  createActionRunForIncident,
  getActionRunWithSteps,
} from "../services/action-runs.js";
import {
  ackIncident,
  getIncidentForOrg,
  listIncidentEventsForOrg,
  listIncidentsForOrg,
  openIncidentManual,
  resolveIncident,
} from "../services/incidents.js";
import { createNotifier } from "../services/notify.js";

const manualCreateIncidentSchema = z.object({
  serviceId: z.string().uuid(),
  title: z.string().min(1).max(200),
  severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]).optional(),
});

const statusQuerySchema = z.enum(["open", "acknowledged", "resolved"]).optional();

export const incidentRoutes = new Hono();

incidentRoutes.use("*", requireOrgMembership);

incidentRoutes.post("/", async (c) => {
  const org = c.get("org");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "Sign in required" } }, 401);
  }

  const parsed = manualCreateIncidentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.flatten() } }, 400);
  }

  const { db } = getDb();
  const notifier = createNotifier();
  const result = await openIncidentManual(db, notifier, {
    orgId: org.id,
    serviceId: parsed.data.serviceId,
    title: parsed.data.title,
    severity: parsed.data.severity,
    openedByUserId: user.id,
  });

  if (!result.ok) {
    if (result.error.code === "service_not_found") {
      return c.json({ error: { code: "not_found", message: "Service not found in this organization" } }, 404);
    }
    return c.json({ error: { code: "policy_missing", message: "Service has no bound policy or no escalation steps" } }, 400);
  }

  return c.json({ incidentId: result.incidentId }, 201);
});

incidentRoutes.get("/", async (c) => {
  const org = c.get("org");
  const raw = c.req.query("status");
  const statusParsed = statusQuerySchema.safeParse(raw === undefined || raw === "" ? undefined : raw);
  if (!statusParsed.success) {
    return c.json({ error: { code: "validation_error", message: "Invalid status query" } }, 400);
  }

  const { db } = getDb();
  const rows = await listIncidentsForOrg(db, { orgId: org.id, status: statusParsed.data });
  return c.json({ incidents: rows });
});

incidentRoutes.get("/:incidentId/events", async (c) => {
  const org = c.get("org");
  const incidentId = c.req.param("incidentId");
  if (!z.string().uuid().safeParse(incidentId).success) {
    return c.json({ error: { code: "not_found", message: "Incident not found" } }, 404);
  }

  const { db } = getDb();
  const events = await listIncidentEventsForOrg(db, { orgId: org.id, incidentId });
  if (!events) {
    return c.json({ error: { code: "not_found", message: "Incident not found" } }, 404);
  }

  return c.json({ events });
});

incidentRoutes.post("/:incidentId/action-runs", async (c) => {
  const org = c.get("org");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "Sign in required" } }, 401);
  }

  const incidentId = c.req.param("incidentId");
  if (!z.string().uuid().safeParse(incidentId).success) {
    return c.json({ error: { code: "not_found", message: "Incident not found" } }, 404);
  }

  const { db } = getDb();
  try {
    const result = await createActionRunForIncident(db, {
      orgId: org.id,
      incidentId,
      createdByUserId: user.id,
    });
    if (!result.ok) {
      return c.json({ error: { code: "not_found", message: "Incident not found" } }, 404);
    }
    return c.json({ runId: result.runId }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "model_failed";
    return c.json({ error: { code: "model_failed", message } }, 500);
  }
});

incidentRoutes.get("/:incidentId/action-runs/:runId", async (c) => {
  const org = c.get("org");
  const incidentId = c.req.param("incidentId");
  const runId = c.req.param("runId");
  if (!z.string().uuid().safeParse(incidentId).success || !z.string().uuid().safeParse(runId).success) {
    return c.json({ error: { code: "not_found", message: "Not found" } }, 404);
  }

  const { db } = getDb();
  const detail = await getActionRunWithSteps(db, { orgId: org.id, incidentId, runId });
  if (!detail) {
    return c.json({ error: { code: "not_found", message: "Run not found" } }, 404);
  }
  return c.json(detail);
});

incidentRoutes.post("/:incidentId/action-runs/:runId/approve", async (c) => {
  const org = c.get("org");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "Sign in required" } }, 401);
  }

  const incidentId = c.req.param("incidentId");
  const runId = c.req.param("runId");
  if (!z.string().uuid().safeParse(incidentId).success || !z.string().uuid().safeParse(runId).success) {
    return c.json({ error: { code: "not_found", message: "Not found" } }, 404);
  }

  const { db } = getDb();
  const outcome = await approveAndExecuteGithubComment(db, { orgId: org.id, incidentId, runId });
  if (!outcome.ok) {
    if (outcome.code === "not_found") {
      return c.json({ error: { code: "not_found", message: "Run not found" } }, 404);
    }
    if (outcome.code === "nothing_to_approve") {
      return c.json({ error: { code: "invalid_state", message: "No pending approval step" } }, 409);
    }
    if (outcome.code === "github_not_configured") {
      return c.json({ error: { code: "github_not_configured", message: outcome.message ?? "" } }, 400);
    }
    return c.json({ error: { code: "execute_failed", message: outcome.message ?? "GitHub API error" } }, 502);
  }
  return c.json({ ok: true, ...outcome.result });
});

incidentRoutes.get("/:incidentId", async (c) => {
  const org = c.get("org");
  const incidentId = c.req.param("incidentId");
  if (!z.string().uuid().safeParse(incidentId).success) {
    return c.json({ error: { code: "not_found", message: "Incident not found" } }, 404);
  }

  const { db } = getDb();
  const detail = await getIncidentForOrg(db, { orgId: org.id, incidentId, timelineLimit: 20 });
  if (!detail) {
    return c.json({ error: { code: "not_found", message: "Incident not found" } }, 404);
  }

  return c.json(detail);
});

incidentRoutes.post("/:incidentId/ack", async (c) => {
  const org = c.get("org");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "Sign in required" } }, 401);
  }

  const incidentId = c.req.param("incidentId");
  if (!z.string().uuid().safeParse(incidentId).success) {
    return c.json({ error: { code: "not_found", message: "Incident not found" } }, 404);
  }

  const { db } = getDb();
  const outcome = await ackIncident(db, { orgId: org.id, incidentId, actorUserId: user.id });
  if (outcome === "not_found") {
    return c.json({ error: { code: "not_found", message: "Incident not found" } }, 404);
  }
  if (outcome === "invalid_state") {
    return c.json({ error: { code: "invalid_state", message: "Ack is only allowed when status is open" } }, 409);
  }
  return c.body(null, 204);
});

incidentRoutes.post("/:incidentId/resolve", async (c) => {
  const org = c.get("org");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "Sign in required" } }, 401);
  }

  const incidentId = c.req.param("incidentId");
  if (!z.string().uuid().safeParse(incidentId).success) {
    return c.json({ error: { code: "not_found", message: "Incident not found" } }, 404);
  }

  const { db } = getDb();
  const outcome = await resolveIncident(db, { orgId: org.id, incidentId, actorUserId: user.id });
  if (outcome === "not_found") {
    return c.json({ error: { code: "not_found", message: "Incident not found" } }, 404);
  }
  if (outcome === "invalid_state") {
    return c.json({ error: { code: "invalid_state", message: "Cannot resolve incident in this state" } }, 409);
  }
  return c.body(null, 204);
});
