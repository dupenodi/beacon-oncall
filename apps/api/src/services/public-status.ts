import { and, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import type { BeaconDb } from "@beacon/db";
import { incidents, orgs, statusPageSettings } from "@beacon/db/schema";

export async function getPublicStatus(db: BeaconDb, orgSlug: string) {
  const [org] = await db
    .select({ id: orgs.id, slug: orgs.slug, name: orgs.name })
    .from(orgs)
    .where(eq(orgs.slug, orgSlug))
    .limit(1);

  if (!org) return null;

  const [settings] = await db
    .select({ showResolvedHours: statusPageSettings.showResolvedHours })
    .from(statusPageSettings)
    .where(eq(statusPageSettings.orgId, org.id))
    .limit(1);

  const hours = settings?.showResolvedHours ?? 72;
  const since = new Date(Date.now() - hours * 3600 * 1000);

  const active = await db
    .select({
      id: incidents.id,
      title: incidents.title,
      severity: incidents.severity,
      status: incidents.status,
      openedAt: incidents.openedAt,
    })
    .from(incidents)
    .where(and(eq(incidents.orgId, org.id), inArray(incidents.status, ["open", "acknowledged"])))
    .orderBy(desc(incidents.openedAt))
    .limit(50);

  const recentResolved = await db
    .select({
      id: incidents.id,
      title: incidents.title,
      severity: incidents.severity,
      resolvedAt: incidents.resolvedAt,
    })
    .from(incidents)
    .where(
      and(
        eq(incidents.orgId, org.id),
        eq(incidents.status, "resolved"),
        isNotNull(incidents.resolvedAt),
        gte(incidents.resolvedAt, since),
      ),
    )
    .orderBy(desc(incidents.resolvedAt))
    .limit(20);

  return {
    org: { slug: org.slug, name: org.name },
    active,
    recentResolved,
  };
}
