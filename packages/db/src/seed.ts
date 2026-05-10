/**
 * Database seed — sample org, users, service, escalation policy, and **portfolio-style incidents**
 * (open / acknowledged / resolved) so a deployed demo always has realistic UI data.
 *
 *   DATABASE_URL=... APP_MASTER_KEY=... npm run seed -w @beacon/db
 *
 * Safe to run multiple times: service/policy are created once; sample incidents use stable dedupe keys
 * and are only inserted if missing.
 *
 * `APP_MASTER_KEY`: 32-byte key as base64 or 64-char hex (same as API for webhook secret crypto).
 */
import argon2 from "argon2";
import { config as loadEnv } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";
import { resolve } from "node:path";
import { createDb, type BeaconDb } from "./index.js";
import { encryptAes256Gcm, parseMasterKeyFromEnv } from "./crypto.js";
import {
  escalationPolicies,
  escalationSteps,
  incidentEvents,
  incidents,
  memberships,
  orgs,
  servicePolicyBindings,
  services,
  users,
} from "./schema.js";

loadEnv({ path: resolve(process.cwd(), "../../.env") });

const DEMO_WEBHOOK_SECRET = "whsec_dev_demo_change_me";

/** Stable dedupe keys — only one open/ack row per key (partial unique index). */
const SEED_DEDUPE = {
  open: "beacon_seed_portfolio_open_v1",
  ack: "beacon_seed_portfolio_ack_v1",
  resolved: "beacon_seed_portfolio_resolved_v1",
} as const;

async function ensurePortfolioIncidents(
  db: BeaconDb,
  ctx: { orgId: string; serviceId: string; ownerId: string; oncallId: string },
) {
  const { orgId, serviceId, ownerId, oncallId } = ctx;
  const keys = [SEED_DEDUPE.open, SEED_DEDUPE.ack, SEED_DEDUPE.resolved] as const;
  const existing = await db
    .select({ dedupeKey: incidents.dedupeKey })
    .from(incidents)
    .where(and(eq(incidents.orgId, orgId), inArray(incidents.dedupeKey, [...keys])));

  const have = new Set(existing.map((r) => r.dedupeKey).filter(Boolean) as string[]);

  const now = Date.now();

  async function insertOpen() {
    const openedAt = new Date(now - 2 * 60 * 60 * 1000);
    const nextActionAt = new Date(now + 45 * 60 * 1000);
    const [row] = await db
      .insert(incidents)
      .values({
        orgId,
        serviceId,
        status: "open",
        severity: "SEV2",
        title: "Elevated 5xx rate on Checkout API",
        dedupeKey: SEED_DEDUPE.open,
        currentStepIndex: 0,
        nextActionAt,
        openedAt,
        openedByUserId: ownerId,
      })
      .returning({ id: incidents.id });
    if (!row) return;
    const t0 = openedAt.getTime();
    await db.insert(incidentEvents).values([
      {
        incidentId: row.id,
        orgId,
        type: "incident.opened",
        payload: { source: "seed", dedupeKey: SEED_DEDUPE.open },
        actorUserId: ownerId,
        createdAt: new Date(t0),
      },
      {
        incidentId: row.id,
        orgId,
        type: "notify.sent",
        payload: { step_index: 0, to_email: "owner@demo.invalid" },
        actorUserId: null,
        createdAt: new Date(t0 + 2000),
      },
    ]);
  }

  async function insertAck() {
    const openedAt = new Date(now - 48 * 60 * 60 * 1000);
    const ackedAt = new Date(now - 2 * 60 * 60 * 1000);
    const [row] = await db
      .insert(incidents)
      .values({
        orgId,
        serviceId,
        status: "acknowledged",
        severity: "SEV3",
        title: "Read replica lag above SLO",
        dedupeKey: SEED_DEDUPE.ack,
        currentStepIndex: 0,
        nextActionAt: null,
        openedAt,
        ackedAt,
        openedByUserId: ownerId,
      })
      .returning({ id: incidents.id });
    if (!row) return;
    const t0 = openedAt.getTime();
    await db.insert(incidentEvents).values([
      {
        incidentId: row.id,
        orgId,
        type: "incident.opened",
        payload: { source: "seed", dedupeKey: SEED_DEDUPE.ack },
        actorUserId: ownerId,
        createdAt: new Date(t0),
      },
      {
        incidentId: row.id,
        orgId,
        type: "notify.sent",
        payload: { step_index: 0, to_email: "owner@demo.invalid" },
        actorUserId: null,
        createdAt: new Date(t0 + 1500),
      },
      {
        incidentId: row.id,
        orgId,
        type: "incident.acknowledged",
        payload: {},
        actorUserId: ownerId,
        createdAt: ackedAt,
      },
    ]);
  }

  async function insertResolved() {
    const openedAt = new Date(now - 72 * 60 * 60 * 1000);
    const ackedAt = new Date(now - 70 * 60 * 60 * 1000);
    const resolvedAt = new Date(now - 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(incidents)
      .values({
        orgId,
        serviceId,
        status: "resolved",
        severity: "SEV4",
        title: "CDN edge certificate renewed successfully",
        dedupeKey: SEED_DEDUPE.resolved,
        currentStepIndex: 0,
        nextActionAt: null,
        openedAt,
        ackedAt,
        resolvedAt,
        openedByUserId: oncallId,
      })
      .returning({ id: incidents.id });
    if (!row) return;
    const t0 = openedAt.getTime();
    await db.insert(incidentEvents).values([
      {
        incidentId: row.id,
        orgId,
        type: "incident.opened",
        payload: { source: "seed", dedupeKey: SEED_DEDUPE.resolved },
        actorUserId: oncallId,
        createdAt: new Date(t0),
      },
      {
        incidentId: row.id,
        orgId,
        type: "notify.sent",
        payload: { step_index: 0, to_email: "oncall@demo.invalid" },
        actorUserId: null,
        createdAt: new Date(t0 + 1000),
      },
      {
        incidentId: row.id,
        orgId,
        type: "incident.acknowledged",
        payload: {},
        actorUserId: oncallId,
        createdAt: ackedAt,
      },
      {
        incidentId: row.id,
        orgId,
        type: "incident.resolved",
        payload: {},
        actorUserId: ownerId,
        createdAt: resolvedAt,
      },
    ]);
  }

  if (!have.has(SEED_DEDUPE.open)) await insertOpen();
  if (!have.has(SEED_DEDUPE.ack)) await insertAck();
  if (!have.has(SEED_DEDUPE.resolved)) await insertResolved();
}

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
    .values({
      slug: "demo",
      name: "Northwind Logistics",
      webhookSecretCipher: cipher,
    })
    .onConflictDoUpdate({
      target: orgs.slug,
      set: { name: "Northwind Logistics", webhookSecretCipher: cipher },
    })
    .returning();

  await db
    .insert(memberships)
    .values([
      { orgId: org.id, userId: owner.id, role: "owner" },
      { orgId: org.id, userId: oncall.id, role: "member" },
    ])
    .onConflictDoNothing();

  const existingSvc = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.orgId, org.id), eq(services.name, "Checkout API")))
    .limit(1);

  let serviceId: string;

  if (existingSvc.length === 0) {
    const [svc] = await db
      .insert(services)
      .values({
        orgId: org.id,
        name: "Checkout API",
        description: "Card-present and online checkout path",
        severity: "SEV2",
      })
      .returning();

    const [policy] = await db
      .insert(escalationPolicies)
      .values({ orgId: org.id, name: "Engineering escalation" })
      .returning();

    await db.insert(escalationSteps).values([
      { policyId: policy.id, stepIndex: 0, waitSeconds: 300, notifyUserId: owner.id },
      { policyId: policy.id, stepIndex: 1, waitSeconds: 300, notifyUserId: oncall.id },
    ]);

    await db.insert(servicePolicyBindings).values({ serviceId: svc.id, policyId: policy.id });
    serviceId = svc.id;
  } else {
    serviceId = existingSvc[0].id;
  }

  await ensurePortfolioIncidents(db, {
    orgId: org.id,
    serviceId,
    ownerId: owner.id,
    oncallId: oncall.id,
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete.", {
    orgSlug: org.slug,
    orgName: org.name,
    ownerEmail,
    oncallEmail,
    demoPassword,
    serviceId,
    webhookPlaintextForSimulators: DEMO_WEBHOOK_SECRET,
    portfolioIncidents: "open + acknowledged + resolved (if not already present)",
  });

  await client.end({ timeout: 5 });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
