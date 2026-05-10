import { and, asc, desc, eq } from "drizzle-orm";
import type { BeaconDb } from "@beacon/db";
import {
  escalationSteps,
  incidentEvents,
  incidents,
  notificationAttempts,
  servicePolicyBindings,
  services,
  users,
} from "@beacon/db/schema";
import type { Notifier } from "./notify";

export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type Severity = "SEV1" | "SEV2" | "SEV3" | "SEV4";

export type OpenManualInput = {
  orgId: string;
  serviceId: string;
  title: string;
  severity?: Severity;
  openedByUserId: string;
};

export type OpenManualError = { code: "service_not_found" | "policy_missing" };

const NOTIFY_ERR_MAX = 500;

function truncateErr(message: string): string {
  return message.length > NOTIFY_ERR_MAX ? message.slice(0, NOTIFY_ERR_MAX) : message;
}

/** Spec C — insert/update notification row, call notifier, append events; does not throw. */
export async function notifyIncidentStep(
  db: BeaconDb,
  notifier: Notifier,
  incidentId: string,
  stepIndex: number,
): Promise<void> {
  const [inc] = await db
    .select({
      id: incidents.id,
      orgId: incidents.orgId,
      serviceId: incidents.serviceId,
      title: incidents.title,
      severity: incidents.severity,
    })
    .from(incidents)
    .where(eq(incidents.id, incidentId))
    .limit(1);

  if (!inc) return;

  const [binding] = await db
    .select({ policyId: servicePolicyBindings.policyId })
    .from(servicePolicyBindings)
    .where(eq(servicePolicyBindings.serviceId, inc.serviceId))
    .limit(1);

  if (!binding) return;

  const [step] = await db
    .select({
      notifyUserId: escalationSteps.notifyUserId,
    })
    .from(escalationSteps)
    .where(and(eq(escalationSteps.policyId, binding.policyId), eq(escalationSteps.stepIndex, stepIndex)))
    .limit(1);

  if (!step) return;

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, step.notifyUserId))
    .limit(1);

  if (!user?.email) return;

  const subject = `[${inc.severity}] ${inc.title}`;
  const text = `Incident: ${inc.id}`;

  await db
    .insert(notificationAttempts)
    .values({
      incidentId: inc.id,
      stepIndex,
      toEmail: user.email,
      status: "pending",
    })
    .onConflictDoUpdate({
      target: [notificationAttempts.incidentId, notificationAttempts.stepIndex],
      set: {
        status: "pending",
        updatedAt: new Date(),
        lastError: null,
      },
    });

  try {
    await notifier.send({ to: user.email, subject, text });
    await db
      .update(notificationAttempts)
      .set({ status: "sent", updatedAt: new Date(), lastError: null })
      .where(
        and(eq(notificationAttempts.incidentId, inc.id), eq(notificationAttempts.stepIndex, stepIndex)),
      );
    await db.insert(incidentEvents).values({
      incidentId: inc.id,
      orgId: inc.orgId,
      type: "notify.sent",
      payload: { stepIndex, to: "redacted" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "notify_error";
    await db
      .update(notificationAttempts)
      .set({
        status: "failed",
        updatedAt: new Date(),
        lastError: truncateErr(message),
      })
      .where(
        and(eq(notificationAttempts.incidentId, inc.id), eq(notificationAttempts.stepIndex, stepIndex)),
      );
    await db.insert(incidentEvents).values({
      incidentId: inc.id,
      orgId: inc.orgId,
      type: "notify.failed",
      payload: { stepIndex, errorCode: "send_failed" },
    });
  }
}

/** Spec A — manual `source: api`; notify failures do not roll back the incident. */
export async function openIncidentManual(
  db: BeaconDb,
  notifier: Notifier,
  input: OpenManualInput,
): Promise<{ ok: true; incidentId: string } | { ok: false; error: OpenManualError }> {
  const [svc] = await db
    .select({
      id: services.id,
      orgId: services.orgId,
      severity: services.severity,
    })
    .from(services)
    .where(and(eq(services.id, input.serviceId), eq(services.orgId, input.orgId)))
    .limit(1);

  if (!svc) {
    return { ok: false, error: { code: "service_not_found" } };
  }

  const [binding] = await db
    .select({ policyId: servicePolicyBindings.policyId })
    .from(servicePolicyBindings)
    .where(eq(servicePolicyBindings.serviceId, svc.id))
    .limit(1);

  const steps = binding
    ? await db
        .select({
          stepIndex: escalationSteps.stepIndex,
          waitSeconds: escalationSteps.waitSeconds,
        })
        .from(escalationSteps)
        .where(eq(escalationSteps.policyId, binding.policyId))
        .orderBy(asc(escalationSteps.stepIndex))
    : [];

  if (!binding || steps.length === 0) {
    return { ok: false, error: { code: "policy_missing" } };
  }

  const step0 = steps.find((s) => s.stepIndex === 0);
  if (!step0) {
    return { ok: false, error: { code: "policy_missing" } };
  }
  const severity = input.severity ?? svc.severity;

  const incidentId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(incidents)
      .values({
        orgId: input.orgId,
        serviceId: svc.id,
        status: "open",
        severity,
        title: input.title,
        currentStepIndex: 0,
        nextActionAt: null,
        openedByUserId: input.openedByUserId,
      })
      .returning({ id: incidents.id });

    if (!row) throw new Error("insert incident failed");

    await tx.insert(incidentEvents).values({
      incidentId: row.id,
      orgId: input.orgId,
      type: "incident.opened",
      payload: { source: "manual", dedupeKey: null },
      actorUserId: input.openedByUserId,
    });

    return row.id;
  });

  try {
    await notifyIncidentStep(db, notifier, incidentId, 0);
  } catch {
    /* notifyIncidentStep is non-throwing; guard anyway */
  }

  const step0Wait = step0.waitSeconds;
  const nextActionAt = new Date(Date.now() + step0Wait * 1000);
  await db.update(incidents).set({ nextActionAt }).where(eq(incidents.id, incidentId));

  return { ok: true, incidentId };
}

/** Spec D */
export async function ackIncident(
  db: BeaconDb,
  params: { orgId: string; incidentId: string; actorUserId: string },
): Promise<"ok" | "not_found" | "invalid_state"> {
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: incidents.id, status: incidents.status })
      .from(incidents)
      .where(and(eq(incidents.id, params.incidentId), eq(incidents.orgId, params.orgId)))
      .limit(1);

    if (!row) return "not_found";
    if (row.status !== "open") return "invalid_state";

    await tx
      .update(incidents)
      .set({
        status: "acknowledged",
        ackedAt: new Date(),
        nextActionAt: null,
      })
      .where(and(eq(incidents.id, params.incidentId), eq(incidents.orgId, params.orgId)));

    await tx.insert(incidentEvents).values({
      incidentId: params.incidentId,
      orgId: params.orgId,
      type: "incident.acknowledged",
      payload: {},
      actorUserId: params.actorUserId,
    });

    return "ok";
  });
}

/** Spec E — idempotent when already resolved. */
export async function resolveIncident(
  db: BeaconDb,
  params: { orgId: string; incidentId: string; actorUserId: string },
): Promise<"ok" | "not_found" | "invalid_state" | "noop_resolved"> {
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: incidents.id, status: incidents.status })
      .from(incidents)
      .where(and(eq(incidents.id, params.incidentId), eq(incidents.orgId, params.orgId)))
      .limit(1);

    if (!row) return "not_found";
    if (row.status === "resolved") return "noop_resolved";
    if (row.status !== "open" && row.status !== "acknowledged") return "invalid_state";

    await tx
      .update(incidents)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        nextActionAt: null,
      })
      .where(and(eq(incidents.id, params.incidentId), eq(incidents.orgId, params.orgId)));

    await tx.insert(incidentEvents).values({
      incidentId: params.incidentId,
      orgId: params.orgId,
      type: "incident.resolved",
      payload: {},
      actorUserId: params.actorUserId,
    });

    return "ok";
  });
}

export async function listIncidentsForOrg(
  db: BeaconDb,
  params: { orgId: string; status?: IncidentStatus },
) {
  const conds = [eq(incidents.orgId, params.orgId)];
  if (params.status) {
    conds.push(eq(incidents.status, params.status));
  }

  return db
    .select({
      id: incidents.id,
      serviceId: incidents.serviceId,
      serviceName: services.name,
      status: incidents.status,
      severity: incidents.severity,
      title: incidents.title,
      dedupeKey: incidents.dedupeKey,
      currentStepIndex: incidents.currentStepIndex,
      nextActionAt: incidents.nextActionAt,
      openedAt: incidents.openedAt,
      ackedAt: incidents.ackedAt,
      resolvedAt: incidents.resolvedAt,
      openedByUserId: incidents.openedByUserId,
      externalRef: incidents.externalRef,
    })
    .from(incidents)
    .innerJoin(services, eq(incidents.serviceId, services.id))
    .where(and(...conds))
    .orderBy(desc(incidents.openedAt));
}

export async function getIncidentForOrg(
  db: BeaconDb,
  params: { orgId: string; incidentId: string; timelineLimit?: number },
) {
  const [inc] = await db
    .select({
      id: incidents.id,
      orgId: incidents.orgId,
      serviceId: incidents.serviceId,
      serviceName: services.name,
      status: incidents.status,
      severity: incidents.severity,
      title: incidents.title,
      dedupeKey: incidents.dedupeKey,
      currentStepIndex: incidents.currentStepIndex,
      nextActionAt: incidents.nextActionAt,
      openedAt: incidents.openedAt,
      ackedAt: incidents.ackedAt,
      resolvedAt: incidents.resolvedAt,
      openedByUserId: incidents.openedByUserId,
      externalRef: incidents.externalRef,
    })
    .from(incidents)
    .innerJoin(services, eq(incidents.serviceId, services.id))
    .where(and(eq(incidents.id, params.incidentId), eq(incidents.orgId, params.orgId)))
    .limit(1);

  if (!inc) return null;

  const limit = params.timelineLimit ?? 20;
  const recent = await db
    .select({
      id: incidentEvents.id,
      type: incidentEvents.type,
      payload: incidentEvents.payload,
      actorUserId: incidentEvents.actorUserId,
      createdAt: incidentEvents.createdAt,
    })
    .from(incidentEvents)
    .where(eq(incidentEvents.incidentId, params.incidentId))
    .orderBy(desc(incidentEvents.createdAt))
    .limit(limit);

  const timelineAsc = [...recent].reverse();

  return { incident: inc, timeline: timelineAsc };
}

export async function listIncidentEventsForOrg(db: BeaconDb, params: { orgId: string; incidentId: string }) {
  const [exists] = await db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(eq(incidents.id, params.incidentId), eq(incidents.orgId, params.orgId)))
    .limit(1);

  if (!exists) return null;

  const rows = await db
    .select({
      id: incidentEvents.id,
      type: incidentEvents.type,
      payload: incidentEvents.payload,
      actorUserId: incidentEvents.actorUserId,
      createdAt: incidentEvents.createdAt,
    })
    .from(incidentEvents)
    .where(
      and(eq(incidentEvents.incidentId, params.incidentId), eq(incidentEvents.orgId, params.orgId)),
    )
    .orderBy(asc(incidentEvents.createdAt));

  return rows;
}
