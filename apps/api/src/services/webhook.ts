import { eq } from "drizzle-orm";
import type { BeaconDb } from "@beacon/db";
import { decryptAes256Gcm, parseMasterKeyFromEnv } from "@beacon/db";
import { orgs } from "@beacon/db/schema";
import { WebhookBodySchema } from "../schemas/webhook";
import { findActiveIncidentByDedupe, openIncident } from "./incidents";
import type { Notifier } from "./notify";
import { verifyBeaconWebhookSignature } from "./webhook-verify";

export type WebhookIngestError = { status: number; code: string; message: string };

export async function ingestSignedWebhook(
  db: BeaconDb,
  params: {
    orgSlug: string;
    rawBody: Uint8Array;
    timestampHeader: string | undefined;
    signatureHeader: string | undefined;
    notifier: Notifier;
  },
): Promise<{ ok: true; incidentId: string; deduped?: boolean } | { ok: false; error: WebhookIngestError }> {
  let rawBodyUtf8: string;
  try {
    rawBodyUtf8 = new TextDecoder("utf-8", { fatal: true }).decode(params.rawBody);
  } catch {
    return { ok: false, error: { status: 400, code: "bad_payload", message: "Body is not valid UTF-8" } };
  }

  const [org] = await db.select().from(orgs).where(eq(orgs.slug, params.orgSlug)).limit(1);
  if (!org) {
    return { ok: false, error: { status: 404, code: "org_not_found", message: "Unknown organization" } };
  }

  let master: Buffer;
  try {
    master = parseMasterKeyFromEnv(process.env.APP_MASTER_KEY);
  } catch {
    return {
      ok: false,
      error: { status: 503, code: "server_misconfigured", message: "APP_MASTER_KEY is not configured" },
    };
  }

  let secret: string;
  try {
    secret = decryptAes256Gcm(org.webhookSecretCipher, master);
  } catch {
    return {
      ok: false,
      error: { status: 503, code: "decrypt_failed", message: "Could not read org webhook secret" },
    };
  }

  const sig = verifyBeaconWebhookSignature(
    secret,
    rawBodyUtf8,
    params.timestampHeader,
    params.signatureHeader,
  );
  if (!sig.ok) {
    if (sig.error.code === "stale_timestamp") {
      return {
        ok: false,
        error: { status: 401, code: "stale_timestamp", message: "Timestamp out of allowed window" },
      };
    }
    return { ok: false, error: { status: 401, code: "bad_signature", message: "Invalid webhook signature" } };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBodyUtf8) as unknown;
  } catch {
    return { ok: false, error: { status: 400, code: "bad_payload", message: "Invalid JSON" } };
  }

  const body = WebhookBodySchema.safeParse(parsedJson);
  if (!body.success) {
    return { ok: false, error: { status: 400, code: "bad_payload", message: "Payload validation failed" } };
  }

  const payload = body.data;
  if (payload.dedupeKey) {
    const existing = await findActiveIncidentByDedupe(db, org.id, payload.dedupeKey);
    if (existing) {
      return { ok: true, incidentId: existing, deduped: true };
    }
  }

  try {
    const opened = await openIncident(db, params.notifier, {
      orgId: org.id,
      serviceId: payload.serviceId,
      title: payload.title,
      severity: payload.severity,
      source: "webhook",
      dedupeKey: payload.dedupeKey ?? null,
      externalRef: payload.externalRef ?? null,
      openedByUserId: null,
    });
    if (!opened.ok) {
      if (opened.error.code === "service_not_found") {
        return {
          ok: false,
          error: { status: 404, code: "service_not_found", message: "Service not found in this organization" },
        };
      }
      return {
        ok: false,
        error: {
          status: 400,
          code: "policy_missing",
          message: "Service has no bound policy or escalation steps",
        },
      };
    }
    return { ok: true, incidentId: opened.incidentId };
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "23505" && payload.dedupeKey) {
      const id = await findActiveIncidentByDedupe(db, org.id, payload.dedupeKey);
      if (id) return { ok: true, incidentId: id, deduped: true };
    }
    throw e;
  }
}
