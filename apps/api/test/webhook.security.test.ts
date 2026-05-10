import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyBeaconWebhookSignature } from "../src/services/webhook-verify";

describe("verifyBeaconWebhookSignature", () => {
  const secret = "whsec_test_123";
  const rawBody =
    '{"schemaVersion":1,"serviceId":"00000000-0000-4000-8000-000000000001","title":"t","severity":"SEV2"}';
  const ts = "1710000000";
  const macInput = `v1:${ts}:${rawBody}`;
  const expectedHex = crypto
    .createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(Buffer.from(macInput, "utf8"))
    .digest("hex");
  const signature = `v1=${expectedHex}`;

  it("accepts a valid signature", () => {
    const r = verifyBeaconWebhookSignature(secret, rawBody, ts, signature, {
      nowSec: 1710000000,
      maxSkewSec: 1_000_000,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects wrong signature", () => {
    const r = verifyBeaconWebhookSignature(secret, rawBody, ts, `v1=${"0".repeat(64)}`, {
      nowSec: 1710000000,
      maxSkewSec: 1_000_000,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("bad_signature");
  });

  it("rejects stale timestamp", () => {
    const r = verifyBeaconWebhookSignature(secret, rawBody, ts, signature, {
      nowSec: 1710099999,
      maxSkewSec: 60,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("stale_timestamp");
  });
});
