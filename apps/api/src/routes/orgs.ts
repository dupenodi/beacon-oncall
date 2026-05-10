import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { encryptAes256Gcm, parseMasterKeyFromEnv } from "@beacon/db";
import { orgs } from "@beacon/db/schema";
import { getDb } from "../lib/db.js";
import { loadSession, requireUser } from "../middleware/session.js";
import { requireOrgMembership } from "../middleware/require-org.js";
import { requireOwner } from "../middleware/require-owner.js";
import { githubIntegrationRoutes } from "./github-integration.js";
import { incidentRoutes } from "./incidents.js";
import { policyRoutes } from "./policies.js";
import { serviceRoutes } from "./services.js";

export const orgRoutes = new Hono();

orgRoutes.use("*", loadSession);
orgRoutes.use("*", requireUser);

orgRoutes.get("/:orgSlug/me", requireOrgMembership, (c) => {
  const org = c.get("org");
  const role = c.get("membershipRole");
  return c.json({ org, role });
});

orgRoutes.route("/:orgSlug/services", serviceRoutes);
orgRoutes.route("/:orgSlug/policies", policyRoutes);
orgRoutes.route("/:orgSlug/incidents", incidentRoutes);
orgRoutes.route("/:orgSlug/integrations/github", githubIntegrationRoutes);

orgRoutes.post("/:orgSlug/webhook-secret/rotate", requireOrgMembership, requireOwner, async (c) => {
  const org = c.get("org");
  let master: Buffer;
  try {
    master = parseMasterKeyFromEnv(process.env.APP_MASTER_KEY);
  } catch {
    return c.json(
      { error: { code: "server_misconfigured", message: "APP_MASTER_KEY is not configured" } },
      503,
    );
  }

  const plain = `whsec_${crypto.randomBytes(32).toString("base64url")}`;
  const cipher = encryptAes256Gcm(plain, master);
  const { db } = getDb();
  await db.update(orgs).set({ webhookSecretCipher: cipher }).where(eq(orgs.id, org.id));

  return c.json({ secretPlaintextOnce: plain });
});
