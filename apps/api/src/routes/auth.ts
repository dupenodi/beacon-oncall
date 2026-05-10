import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { sessions, users } from "@beacon/db/schema";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "../constants.js";
import { getDb } from "../lib/db.js";
import { hashSessionToken, randomSessionToken } from "../lib/session-token.js";
import { loadSession, requireUser } from "../middleware/session.js";
import argon2 from "argon2";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.flatten() } }, 400);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { db } = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user?.passwordHash) {
    return c.json({ error: { code: "invalid_credentials", message: "Invalid email or password" } }, 401);
  }

  const ok = await argon2.verify(user.passwordHash, parsed.data.password);
  if (!ok) {
    return c.json({ error: { code: "invalid_credentials", message: "Invalid email or password" } }, 401);
  }

  const token = randomSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.insert(sessions).values({ userId: user.id, tokenHash, expiresAt });

  const crossOrigin = process.env.NODE_ENV === "production";
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: crossOrigin ? "None" : "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    secure: crossOrigin,
  });

  return c.json({ user: { id: user.id, email: user.email } });
});

authRoutes.post("/logout", loadSession, requireUser, async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    const { db } = getDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
  }
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    secure: process.env.NODE_ENV === "production",
  });
  return c.body(null, 204);
});

authRoutes.get("/me", loadSession, (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ user: null });
  }
  return c.json({ user });
});
