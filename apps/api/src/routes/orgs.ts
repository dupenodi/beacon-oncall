import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { services } from "@beacon/db/schema";
import { getDb } from "../lib/db";
import { loadSession, requireUser } from "../middleware/session";
import { requireOrgMembership } from "../middleware/require-org";

export const orgRoutes = new Hono();

orgRoutes.use("*", loadSession);
orgRoutes.use("*", requireUser);

orgRoutes.get("/:orgSlug/me", requireOrgMembership, (c) => {
  const org = c.get("org");
  const role = c.get("membershipRole");
  return c.json({ org, role });
});

orgRoutes.get("/:orgSlug/services", requireOrgMembership, async (c) => {
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
