import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { escalationPolicies, escalationSteps, memberships } from "@beacon/db/schema";
import { getDb } from "../lib/db.js";
import { requireOrgMembership } from "../middleware/require-org.js";

const stepSchema = z.object({
  waitSeconds: z.number().int().min(0),
  notifyUserId: z.string().uuid(),
});

const createPolicySchema = z.object({
  name: z.string().min(1).max(200),
  steps: z.array(stepSchema).min(1),
});

export const policyRoutes = new Hono();

policyRoutes.use("*", requireOrgMembership);

policyRoutes.get("/", async (c) => {
  const org = c.get("org");
  const { db } = getDb();
  const rows = await db
    .select({
      id: escalationPolicies.id,
      name: escalationPolicies.name,
      createdAt: escalationPolicies.createdAt,
    })
    .from(escalationPolicies)
    .where(eq(escalationPolicies.orgId, org.id))
    .orderBy(asc(escalationPolicies.createdAt));

  return c.json({ policies: rows });
});

policyRoutes.post("/", async (c) => {
  const org = c.get("org");
  const parsed = createPolicySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.flatten() } }, 400);
  }

  const { db } = getDb();

  for (const step of parsed.data.steps) {
    const [m] = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.orgId, org.id), eq(memberships.userId, step.notifyUserId)))
      .limit(1);

    if (!m) {
      return c.json(
        {
          error: {
            code: "validation_error",
            message: `notifyUserId ${step.notifyUserId} is not a member of this organization`,
          },
        },
        400,
      );
    }
  }

  const [pol] = await db
    .insert(escalationPolicies)
    .values({ orgId: org.id, name: parsed.data.name.trim() })
    .returning({ id: escalationPolicies.id });

  if (!pol) {
    return c.json({ error: { code: "server_error", message: "Failed to create policy" } }, 500);
  }

  for (let i = 0; i < parsed.data.steps.length; i += 1) {
    const s = parsed.data.steps[i]!;
    await db.insert(escalationSteps).values({
      policyId: pol.id,
      stepIndex: i,
      waitSeconds: s.waitSeconds,
      notifyUserId: s.notifyUserId,
    });
  }

  return c.json({ policyId: pol.id }, 201);
});
