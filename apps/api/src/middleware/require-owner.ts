import type { MiddlewareHandler } from "hono";

/** After `requireOrgMembership`. */
export const requireOwner: MiddlewareHandler = async (c, next) => {
  if (c.get("membershipRole") !== "owner") {
    return c.json({ error: { code: "forbidden", message: "Owner role required" } }, 403);
  }
  return next();
};
