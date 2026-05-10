import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { encryptAes256Gcm, parseMasterKeyFromEnv } from "@beacon/db";
import { integrationsGithub } from "@beacon/db/schema";
import { getDb } from "../lib/db";
import { requireOrgMembership } from "../middleware/require-org";
import { requireOwner } from "../middleware/require-owner";

const putBody = z.object({
  pat: z.string().min(1).max(5000),
  defaultRepo: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, "defaultRepo must look like owner/repo"),
});

export const githubIntegrationRoutes = new Hono();

githubIntegrationRoutes.use("*", requireOrgMembership);

githubIntegrationRoutes.get("/", async (c) => {
  const org = c.get("org");
  const { db } = getDb();
  const [row] = await db
    .select({ defaultRepo: integrationsGithub.defaultRepo })
    .from(integrationsGithub)
    .where(eq(integrationsGithub.orgId, org.id))
    .limit(1);

  return c.json({
    configured: Boolean(row),
    defaultRepo: row?.defaultRepo ?? null,
  });
});

githubIntegrationRoutes.put("/", requireOwner, async (c) => {
  const org = c.get("org");
  const parsed = putBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.flatten() } }, 400);
  }

  let master: Buffer;
  try {
    master = parseMasterKeyFromEnv(process.env.APP_MASTER_KEY);
  } catch {
    return c.json(
      { error: { code: "server_misconfigured", message: "APP_MASTER_KEY is not configured" } },
      503,
    );
  }

  const cipher = encryptAes256Gcm(parsed.data.pat, master);
  const { db } = getDb();

  await db
    .insert(integrationsGithub)
    .values({
      orgId: org.id,
      patCipher: cipher,
      defaultRepo: parsed.data.defaultRepo,
    })
    .onConflictDoUpdate({
      target: integrationsGithub.orgId,
      set: { patCipher: cipher, defaultRepo: parsed.data.defaultRepo },
    });

  return c.body(null, 204);
});
