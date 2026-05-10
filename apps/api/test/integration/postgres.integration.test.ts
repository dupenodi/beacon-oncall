import { execSync } from "node:child_process";
import crypto from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { BeaconDb } from "@beacon/db";
import { encryptAes256Gcm } from "@beacon/db";
import {
  actionRuns,
  incidentEvents,
  incidents,
  integrationsGithub,
  orgs,
  services,
  users,
} from "@beacon/db/schema";

const DEMO_WEBHOOK_SECRET = "whsec_dev_demo_change_me";

const thisDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(thisDir, "../../..");

/** Same shape as `verifyBeaconWebhookSignature` mac input. */
function beaconWebhookHeaders(secret: string, rawBodyUtf8: string) {
  const ts = String(Math.floor(Date.now() / 1000));
  const macInput = `v1:${ts}:${rawBodyUtf8}`;
  const sig = crypto
    .createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(Buffer.from(macInput, "utf8"))
    .digest("hex");
  return { "X-Beacon-Timestamp": ts, "X-Beacon-Signature": `v1=${sig}` };
}

let container: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
const APP_MASTER_KEY = Buffer.alloc(32, 11).toString("hex");

type ApiDeps = {
  getDb: () => { db: BeaconDb; client: { end: (o?: { timeout?: number }) => Promise<void> } };
  processTickBatch: typeof import("../../src/services/escalation.js").processTickBatch;
  openIncidentManual: typeof import("../../src/services/incidents.js").openIncidentManual;
  ackIncident: typeof import("../../src/services/incidents.js").ackIncident;
  resolveIncident: typeof import("../../src/services/incidents.js").resolveIncident;
  ingestSignedWebhook: typeof import("../../src/services/webhook.js").ingestSignedWebhook;
  createConsoleNotifier: typeof import("../../src/services/notify.js").createConsoleNotifier;
  createActionRunForIncident: typeof import("../../src/services/action-runs.js").createActionRunForIncident;
  approveAndExecuteGithubComment: typeof import("../../src/services/action-runs.js").approveAndExecuteGithubComment;
};

let deps: ApiDeps;

async function loadDemoFixture(db: BeaconDb) {
  const [o] = await db.select().from(orgs).where(eq(orgs.slug, "demo")).limit(1);
  if (!o) throw new Error("demo org missing after seed");
  const [svc] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.orgId, o.id), eq(services.name, "Checkout API")))
    .limit(1);
  if (!svc) throw new Error("Checkout API service missing after seed");
  const [owner] = await db.select().from(users).where(eq(users.email, "owner@demo.invalid")).limit(1);
  if (!owner) throw new Error("owner user missing after seed");
  return { orgId: o.id, serviceId: svc.id, ownerId: owner.id };
}

beforeAll(async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.APP_MASTER_KEY = APP_MASTER_KEY;

  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const databaseUrl = container.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;

  execSync("npm run migrate -w @beacon/db", {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl, APP_MASTER_KEY },
  });
  execSync("npm run seed -w @beacon/db", {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl, APP_MASTER_KEY },
  });

  const modDb = await import("../../src/lib/db.js");
  const esc = await import("../../src/services/escalation.js");
  const inc = await import("../../src/services/incidents.js");
  const wh = await import("../../src/services/webhook.js");
  const notify = await import("../../src/services/notify.js");
  const ar = await import("../../src/services/action-runs.js");

  deps = {
    getDb: modDb.getDb,
    processTickBatch: esc.processTickBatch,
    openIncidentManual: inc.openIncidentManual,
    ackIncident: inc.ackIncident,
    resolveIncident: inc.resolveIncident,
    ingestSignedWebhook: wh.ingestSignedWebhook,
    createConsoleNotifier: notify.createConsoleNotifier,
    createActionRunForIncident: ar.createActionRunForIncident,
    approveAndExecuteGithubComment: ar.approveAndExecuteGithubComment,
  };
}, 180_000);

afterAll(async () => {
  const { client } = deps?.getDb() ?? { client: null };
  if (client) {
    await client.end({ timeout: 5 });
  }
  if (container) {
    await container.stop();
  }
});

describe("Postgres integration (tick / resolve / race / webhook)", () => {
  it("advances escalation when next_action_at is due", async () => {
    const { db } = deps.getDb();
    const notifier = deps.createConsoleNotifier();
    const { orgId, serviceId, ownerId } = await loadDemoFixture(db);

    const opened = await deps.openIncidentManual(db, notifier, {
      orgId,
      serviceId,
      title: "tick-advance",
      openedByUserId: ownerId,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const incidentId = opened.incidentId;

    await db
      .update(incidents)
      .set({ nextActionAt: new Date(Date.now() - 60_000) })
      .where(eq(incidents.id, incidentId));

    const out = await deps.processTickBatch(db, notifier, 50);
    expect(out.errors).toBe(0);
    expect(out.advanced).toBeGreaterThanOrEqual(1);

    const [row] = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    expect(row?.currentStepIndex).toBe(1);

    const ev = await db
      .select({ type: incidentEvents.type })
      .from(incidentEvents)
      .where(eq(incidentEvents.incidentId, incidentId))
      .orderBy(desc(incidentEvents.createdAt));

    expect(ev.some((e) => e.type === "escalation.advanced")).toBe(true);
  });

  it("exhausts escalation on the last policy step", async () => {
    const { db } = deps.getDb();
    const notifier = deps.createConsoleNotifier();
    const { orgId, serviceId, ownerId } = await loadDemoFixture(db);

    const opened = await deps.openIncidentManual(db, notifier, {
      orgId,
      serviceId,
      title: "tick-exhaust",
      openedByUserId: ownerId,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const incidentId = opened.incidentId;

    for (let i = 0; i < 2; i += 1) {
      await db
        .update(incidents)
        .set({ nextActionAt: new Date(Date.now() - 60_000) })
        .where(eq(incidents.id, incidentId));
      const out = await deps.processTickBatch(db, notifier, 50);
      expect(out.errors).toBe(0);
    }

    const [row] = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    expect(row?.currentStepIndex).toBe(1);
    expect(row?.nextActionAt).toBeNull();

    const ev = await db
      .select({ type: incidentEvents.type })
      .from(incidentEvents)
      .where(eq(incidentEvents.incidentId, incidentId));

    expect(ev.some((e) => e.type === "escalation.exhausted")).toBe(true);
  });

  it("does not tick resolved incidents", async () => {
    const { db } = deps.getDb();
    const notifier = deps.createConsoleNotifier();
    const { orgId, serviceId, ownerId } = await loadDemoFixture(db);

    const opened = await deps.openIncidentManual(db, notifier, {
      orgId,
      serviceId,
      title: "resolved-skip",
      openedByUserId: ownerId,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const incidentId = opened.incidentId;

    const r = await deps.resolveIncident(db, { orgId, incidentId, actorUserId: ownerId });
    expect(r).toBe("ok");

    await db
      .update(incidents)
      .set({ nextActionAt: new Date(Date.now() - 60_000) })
      .where(eq(incidents.id, incidentId));

    const before = await db
      .select({ type: incidentEvents.type })
      .from(incidentEvents)
      .where(eq(incidentEvents.incidentId, incidentId));

    const out = await deps.processTickBatch(db, notifier, 50);
    expect(out.errors).toBe(0);

    const after = await db
      .select({ type: incidentEvents.type })
      .from(incidentEvents)
      .where(eq(incidentEvents.incidentId, incidentId));

    expect(after.length).toBe(before.length);
    expect(after.some((e) => e.type === "escalation.advanced")).toBe(false);
  });

  it("concurrent ack and tick leaves a consistent incident row", async () => {
    const { db } = deps.getDb();
    const notifier = deps.createConsoleNotifier();
    const { orgId, serviceId, ownerId } = await loadDemoFixture(db);

    const opened = await deps.openIncidentManual(db, notifier, {
      orgId,
      serviceId,
      title: "race-ack-tick",
      openedByUserId: ownerId,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const incidentId = opened.incidentId;

    await db
      .update(incidents)
      .set({ nextActionAt: new Date(Date.now() - 60_000) })
      .where(eq(incidents.id, incidentId));

    await Promise.all([
      deps.ackIncident(db, { orgId, incidentId, actorUserId: ownerId }),
      deps.processTickBatch(db, notifier, 50),
    ]);

    const [row] = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
    expect(row).toBeTruthy();
    const ok =
      (row!.status === "acknowledged" && row!.nextActionAt === null) ||
      (row!.status === "open" && row!.currentStepIndex >= 1);
    expect(ok).toBe(true);
  });

  it("webhook dedupe returns the same incident id", async () => {
    const { db } = deps.getDb();
    const notifier = deps.createConsoleNotifier();
    const { serviceId } = await loadDemoFixture(db);

    const dedupeKey = `dedupe-${crypto.randomUUID()}`;
    const raw = JSON.stringify({
      schemaVersion: 1,
      serviceId,
      title: "dedupe-title",
      severity: "SEV2",
      dedupeKey,
    });
    const bodyBytes = new TextEncoder().encode(raw);
    const headers = beaconWebhookHeaders(DEMO_WEBHOOK_SECRET, raw);

    const a = await deps.ingestSignedWebhook(db, {
      orgSlug: "demo",
      rawBody: bodyBytes,
      timestampHeader: headers["X-Beacon-Timestamp"],
      signatureHeader: headers["X-Beacon-Signature"],
      notifier,
    });
    expect(a.ok).toBe(true);
    if (!a.ok) return;

    const headers2 = beaconWebhookHeaders(DEMO_WEBHOOK_SECRET, raw);
    const b = await deps.ingestSignedWebhook(db, {
      orgSlug: "demo",
      rawBody: bodyBytes,
      timestampHeader: headers2["X-Beacon-Timestamp"],
      signatureHeader: headers2["X-Beacon-Signature"],
      notifier,
    });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.deduped).toBe(true);
    expect(b.incidentId).toBe(a.incidentId);
  });
});

describe("CP09 approve path (mocked GitHub HTTP)", () => {
  it("approveAndExecuteGithubComment POSTs issue comment and updates steps", async () => {
    const { db } = deps.getDb();
    const notifier = deps.createConsoleNotifier();
    const { orgId, serviceId, ownerId } = await loadDemoFixture(db);

    const opened = await deps.openIncidentManual(db, notifier, {
      orgId,
      serviceId,
      title: "approve-github",
      openedByUserId: ownerId,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const incidentId = opened.incidentId;

    const master = Buffer.from(APP_MASTER_KEY, "hex");
    const fakePat = "ghp_integration_test_fake_token";
    const cipher = encryptAes256Gcm(fakePat, master);
    await db
      .insert(integrationsGithub)
      .values({ orgId, patCipher: cipher, defaultRepo: "beacon-ci/example-repo" })
      .onConflictDoUpdate({
        target: integrationsGithub.orgId,
        set: { patCipher: cipher, defaultRepo: "beacon-ci/example-repo" },
      });

    const run = await deps.createActionRunForIncident(db, {
      orgId,
      incidentId,
      createdByUserId: ownerId,
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;

    const expectedUrl =
      "https://api.github.com/repos/beacon-ci/example-repo/issues/1/comments";

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe(expectedUrl);
      expect(init?.method).toBe("POST");
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      expect(auth).toBe(`Bearer ${fakePat}`);
      return new Response(JSON.stringify({ id: 424242, html_url: "https://github.com/example/42#issuecomment-424242" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock as typeof fetch);

    try {
      const outcome = await deps.approveAndExecuteGithubComment(db, {
        orgId,
        incidentId,
        runId: run.runId,
      });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.result.html_url).toContain("github.com");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }

    const { db: db2 } = deps.getDb();
    const [runRow] = await db2.select({ status: actionRuns.status }).from(actionRuns).where(eq(actionRuns.id, run.runId)).limit(1);
    expect(runRow?.status).toBe("completed");
  });
});
