import { and, eq, gt, sql } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { sessions, users } from "@beacon/db/schema";
import { SESSION_COOKIE_NAME } from "../constants.js";
import { getDb } from "../lib/db.js";
import { hashSessionToken } from "../lib/session-token.js";

export type AuthedUser = { id: string; email: string };

declare module "hono" {
  interface ContextVariableMap {
    user: AuthedUser | null;
  }
}

/** Loads `c.set("user", …)` from session cookie when present; otherwise `null`. */
export const loadSession: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    c.set("user", null);
    return next();
  }

  const { db } = getDb();
  const tokenHash = hashSessionToken(token);
  const rows = await db
    .select({
      userId: sessions.userId,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    c.set("user", null);
    return next();
  }

  c.set("user", { id: row.userId, email: row.email });
  return next();
};

export const requireUser: MiddlewareHandler = async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "Sign in required" } }, 401);
  }
  return next();
};
