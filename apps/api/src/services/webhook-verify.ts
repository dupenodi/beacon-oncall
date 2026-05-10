import crypto from "node:crypto";

const DEFAULT_MAX_SKEW_SEC = 300;

export type WebhookVerifyFailure = { code: "bad_signature" | "stale_timestamp" | "missing_headers" | "invalid_signature_format" };

/** Byte-accurate HMAC per BEACON_SPEC — `macInput = utf8("v1:" + timestamp + ":" + rawBodyUtf8)` */
export function verifyBeaconWebhookSignature(
  orgSecretUtf8: string,
  rawBodyUtf8: string,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
  options?: { maxSkewSec?: number; nowSec?: number },
): { ok: true } | { ok: false; error: WebhookVerifyFailure } {
  if (!timestampHeader?.trim() || !signatureHeader?.trim()) {
    return { ok: false, error: { code: "missing_headers" } };
  }

  const ts = Number.parseInt(timestampHeader.trim(), 10);
  if (!Number.isFinite(ts) || ts < 0) {
    return { ok: false, error: { code: "stale_timestamp" } };
  }

  const nowSec = options?.nowSec ?? Math.floor(Date.now() / 1000);
  const maxSkew = options?.maxSkewSec ?? DEFAULT_MAX_SKEW_SEC;
  if (Math.abs(nowSec - ts) > maxSkew) {
    return { ok: false, error: { code: "stale_timestamp" } };
  }

  const m = /^v1=([0-9a-fA-F]+)$/.exec(signatureHeader.trim());
  if (!m?.[1]) {
    return { ok: false, error: { code: "invalid_signature_format" } };
  }
  const providedHex = m[1].toLowerCase();

  const macInput = `v1:${timestampHeader.trim()}:${rawBodyUtf8}`;
  const expectedHex = crypto
    .createHmac("sha256", Buffer.from(orgSecretUtf8, "utf8"))
    .update(Buffer.from(macInput, "utf8"))
    .digest("hex");

  const a = Buffer.from(expectedHex, "utf8");
  const b = Buffer.from(providedHex, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: { code: "bad_signature" } };
  }

  return { ok: true };
}
