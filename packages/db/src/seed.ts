/**
 * Dev seed — inserts demo org, users, service, escalation policy (2 steps), binding.
 *
 *   DATABASE_URL=... APP_MASTER_KEY=... npm run seed -w @beacon/db
 *
 * `APP_MASTER_KEY`: 32-byte key as base64 or 64-char hex (same as API will use for webhook secret crypto).
 */
import argon2 from "argon2";
import { config as loadEnv } from "dotenv";
import { and, eq } from "drizzle-orm";
import { resolve } from "node:path";
import { createDb } from "./index.js";
import { encryptAes256Gcm, parseMasterKeyFromEnv } from "./crypto.js";
import {
  escalationPolicies,
  escalationSteps,
  memberships,
  orgs,
  servicePolicyBindings,
  services,
  users,
} from "./schema.js";

loadEnv({ path: resolve(process.cwd(), "../../.env") });

const DEMO_WEBHOOK_SECRET = "whsec_dev_demo_change_me";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const masterKey = parseMasterKeyFromEnv(process.env.APP_MASTER_KEY);

  const { db, client } = createDb(databaseUrl);

  const demoPassword = process.env.DEMO_SEED_PASSWORD ?? "demo";
  const passwordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });

  const ownerEmail = "owner@demo.invalid".toLowerCase();
  const oncallEmail = "oncall@demo.invalid".toLowerCase();

  const [owner] = await db
    .insert(users)
    .values({ email: ownerEmail, passwordHash })
    .onConflictDoUpdate({ target: users.email, set: { email: ownerEmail, passwordHash } })
    .returning();

  const [oncall] = await db
    .insert(users)
    .values({ email: oncallEmail, passwordHash })
    .onConflictDoUpdate({ target: users.email, set: { email: oncallEmail, passwordHash } })
    .returning();

  const cipher = encryptAes256Gcm(DEMO_WEBHOOK_SECRET, masterKey);

  const [org] = await db
    .insert(orgs)
    .values({ slug: "demo", name: "Demo Org", webhookSecretCipher: cipher })
    .onConflictDoUpdate({
      target: orgs.slug,
      set: { name: "Demo Org", webhookSecretCipher: cipher },
    })
    .returning();

  await db
    .insert(memberships)
    .values([
      { orgId: org.id, userId: owner.id, role: "owner" },
      { orgId: org.id, userId: oncall.id, role: "member" },
    ])
    .onConflictDoNothing();

  const existingService = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.orgId, org.id), eq(services.name, "Checkout API")))
    .limit(1);

  if (existingService.length > 0) {
    // eslint-disable-next-line no-console
    console.log("Seed skipped: demo service already exists.", { serviceId: existingService[0].id, orgSlug: org.slug });
    await client.end({ timeout: 5 });
    return;
  }

  const [svc] = await db
    .insert(services)
    .values({
      orgId: org.id,
      name: "Checkout API",
      description: "Synthetic demo service",
      severity: "SEV2",
    })
    .returning();

  const [policy] = await db
    .insert(escalationPolicies)
    .values({ orgId: org.id, name: "Default demo policy" })
    .returning();

  await db.insert(escalationSteps).values([
    { policyId: policy.id, stepIndex: 0, waitSeconds: 300, notifyUserId: owner.id },
    { policyId: policy.id, stepIndex: 1, waitSeconds: 300, notifyUserId: oncall.id },
  ]);

  await db.insert(servicePolicyBindings).values({ serviceId: svc.id, policyId: policy.id });

  // eslint-disable-next-line no-console
  console.log("Seed complete.", {
    orgSlug: org.slug,
    ownerEmail,
    oncallEmail,
    demoPassword,
    serviceId: svc.id,
    policyId: policy.id,
    webhookPlaintextForSimulators: DEMO_WEBHOOK_SECRET,
  });

  await client.end({ timeout: 5 });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
