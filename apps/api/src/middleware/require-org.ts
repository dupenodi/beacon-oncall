import { and, eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { memberships, orgs } from "@beacon/db/schema";
import { getDb } from "../lib/db";

export type OrgContext = {
  id: string;
  slug: string;
  name: string;
};

export type MembershipRole = "owner" | "member";

declare module "hono" {
  interface ContextVariableMap {
    org: OrgContext;
    membershipRole: MembershipRole;
  }
}

/** Requires `loadSession` + `requireUser` before this. Resolves org slug + membership. */
export const requireOrgMembership: MiddlewareHandler = async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "Sign in required" } }, 401);
  }

  const slug = c.req.param("orgSlug");
  if (!slug) {
    return c.json({ error: { code: "bad_request", message: "Missing org slug" } }, 400);
  }

  const { db } = getDb();
  const rows = await db
    .select({
      org: { id: orgs.id, slug: orgs.slug, name: orgs.name },
      role: memberships.role,
    })
    .from(orgs)
    .innerJoin(memberships, eq(orgs.id, memberships.orgId))
    .where(and(eq(orgs.slug, slug), eq(memberships.userId, user.id)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: { code: "forbidden", message: "No access to this organization" } }, 403);
  }

  c.set("org", row.org);
  c.set("membershipRole", row.role);
  return next();
};
