import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { escalationPolicies, servicePolicyBindings, services } from "@beacon/db/schema";
import { getDb } from "../lib/db";
import { requireOrgMembership } from "../middleware/require-org";

const createServiceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]),
});

const patchServiceSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]).optional(),
  })
  .refine((o) => o.name !== undefined || o.description !== undefined || o.severity !== undefined, {
    message: "At least one field required",
  });

const bindPolicySchema = z.object({
  policyId: z.string().uuid(),
});

export const serviceRoutes = new Hono();

serviceRoutes.use("*", requireOrgMembership);

serviceRoutes.get("/", async (c) => {
  const org = c.get("org");
  const { db } = getDb();
  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      description: services.description,
      severity: services.severity,
      createdAt: services.createdAt,
    })
    .from(services)
    .where(eq(services.orgId, org.id));

  return c.json({ services: rows });
});

serviceRoutes.post("/", async (c) => {
  const org = c.get("org");
  const parsed = createServiceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.flatten() } }, 400);
  }

  const { db } = getDb();
  try {
    const [row] = await db
      .insert(services)
      .values({
        orgId: org.id,
        name: parsed.data.name.trim(),
        description: parsed.data.description ?? null,
        severity: parsed.data.severity,
      })
      .returning({
        id: services.id,
        name: services.name,
        description: services.description,
        severity: services.severity,
        createdAt: services.createdAt,
      });
    return c.json({ service: row }, 201);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "23505") {
      return c.json(
        { error: { code: "name_conflict", message: "A service with this name already exists in this organization" } },
        409,
      );
    }
    throw e;
  }
});

serviceRoutes.patch("/:serviceId", async (c) => {
  const org = c.get("org");
  const serviceId = c.req.param("serviceId");
  if (!z.string().uuid().safeParse(serviceId).success) {
    return c.json({ error: { code: "not_found", message: "Service not found" } }, 404);
  }

  const parsed = patchServiceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.flatten() } }, 400);
  }

  const { db } = getDb();
  const [svc] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.orgId, org.id)))
    .limit(1);

  if (!svc) {
    return c.json({ error: { code: "not_found", message: "Service not found" } }, 404);
  }

  const patch: {
    name?: string;
    description?: string | null;
    severity?: "SEV1" | "SEV2" | "SEV3" | "SEV4";
  } = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.severity !== undefined) patch.severity = parsed.data.severity;

  const [updated] = await db.update(services).set(patch).where(eq(services.id, serviceId)).returning({
    id: services.id,
    name: services.name,
    description: services.description,
    severity: services.severity,
    createdAt: services.createdAt,
  });

  return c.json({ service: updated });
});

serviceRoutes.post("/:serviceId/policy", async (c) => {
  const org = c.get("org");
  const serviceId = c.req.param("serviceId");
  if (!z.string().uuid().safeParse(serviceId).success) {
    return c.json({ error: { code: "not_found", message: "Service not found" } }, 404);
  }

  const parsed = bindPolicySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.flatten() } }, 400);
  }

  const { db } = getDb();
  const [svc] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.orgId, org.id)))
    .limit(1);

  if (!svc) {
    return c.json({ error: { code: "not_found", message: "Service not found" } }, 404);
  }

  const [pol] = await db
    .select({ id: escalationPolicies.id })
    .from(escalationPolicies)
    .where(and(eq(escalationPolicies.id, parsed.data.policyId), eq(escalationPolicies.orgId, org.id)))
    .limit(1);

  if (!pol) {
    return c.json({ error: { code: "not_found", message: "Policy not found in this organization" } }, 404);
  }

  await db
    .insert(servicePolicyBindings)
    .values({ serviceId, policyId: parsed.data.policyId })
    .onConflictDoUpdate({
      target: servicePolicyBindings.serviceId,
      set: { policyId: parsed.data.policyId },
    });

  return c.body(null, 204);
});
