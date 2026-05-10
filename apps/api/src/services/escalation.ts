import { and, eq, max, sql } from "drizzle-orm";
import type { BeaconDb } from "@beacon/db";
import {
  escalationSteps,
  incidentEvents,
  incidents,
  servicePolicyBindings,
} from "@beacon/db/schema";
import { notifyIncidentStep } from "./incidents";
import type { Notifier } from "./notify";

/** Spec F — one transaction: lock due rows, then process each. */
export async function processTickBatch(
  db: BeaconDb,
  notifier: Notifier,
  limit = 50,
): Promise<{ processed: number; advanced: number; errors: number }> {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  let processed = 0;
  let advanced = 0;
  let errors = 0;

  await db.transaction(async (tx) => {
    const locked = await tx.execute<{ id: string }>(
      sql`
        SELECT id::text AS id
        FROM incidents
        WHERE resolved_at IS NULL
          AND acked_at IS NULL
          AND next_action_at IS NOT NULL
          AND next_action_at <= now()
        ORDER BY next_action_at ASC
        LIMIT ${lim}
        FOR UPDATE SKIP LOCKED
      `,
    );

    const rows = [...locked] as { id: string }[];

    for (const { id } of rows) {
      try {
        const [inc] = await tx.select().from(incidents).where(eq(incidents.id, id)).limit(1);
        if (!inc) {
          processed += 1;
          continue;
        }
        if (inc.resolvedAt || inc.ackedAt) {
          processed += 1;
          continue;
        }
        if (!inc.nextActionAt || inc.nextActionAt > new Date()) {
          processed += 1;
          continue;
        }

        const [binding] = await tx
          .select({ policyId: servicePolicyBindings.policyId })
          .from(servicePolicyBindings)
          .where(eq(servicePolicyBindings.serviceId, inc.serviceId))
          .limit(1);

        if (!binding) {
          processed += 1;
          continue;
        }

        const [agg] = await tx
          .select({ lastIdx: max(escalationSteps.stepIndex) })
          .from(escalationSteps)
          .where(eq(escalationSteps.policyId, binding.policyId));

        const lastStepIndex = agg?.lastIdx ?? -1;
        if (lastStepIndex < 0) {
          processed += 1;
          continue;
        }

        if (inc.currentStepIndex === lastStepIndex) {
          await tx
            .update(incidents)
            .set({ nextActionAt: null })
            .where(eq(incidents.id, inc.id));
          await tx.insert(incidentEvents).values({
            incidentId: inc.id,
            orgId: inc.orgId,
            type: "escalation.exhausted",
            payload: { lastStepIndex },
          });
          processed += 1;
          continue;
        }

        const newIndex = inc.currentStepIndex + 1;
        await tx
          .update(incidents)
          .set({ currentStepIndex: newIndex })
          .where(eq(incidents.id, inc.id));

        await tx.insert(incidentEvents).values({
          incidentId: inc.id,
          orgId: inc.orgId,
          type: "escalation.advanced",
          payload: { from: inc.currentStepIndex, to: newIndex },
        });

        const [nextStep] = await tx
          .select({ waitSeconds: escalationSteps.waitSeconds })
          .from(escalationSteps)
          .where(
            and(eq(escalationSteps.policyId, binding.policyId), eq(escalationSteps.stepIndex, newIndex)),
          )
          .limit(1);

        const waitSec = nextStep?.waitSeconds ?? 0;
        const nextActionAt = new Date(Date.now() + waitSec * 1000);
        await tx.update(incidents).set({ nextActionAt }).where(eq(incidents.id, inc.id));

        await notifyIncidentStep(tx as unknown as BeaconDb, notifier, inc.id, newIndex);

        processed += 1;
        advanced += 1;
      } catch {
        errors += 1;
        processed += 1;
      }
    }
  });

  return { processed, advanced, errors };
}
