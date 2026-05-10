import crypto from "node:crypto";

function sign(secret: string, rawBodyUtf8: string, timestampSec: number): string {
  const macInput = `v1:${timestampSec}:${rawBodyUtf8}`;
  const hex = crypto
    .createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(Buffer.from(macInput, "utf8"))
    .digest("hex");
  return `v1=${hex}`;
}

function getArg(argv: string[], name: string): string {
  const i = argv.indexOf(name);
  if (i === -1 || i >= argv.length - 1) {
    throw new Error(`Missing required flag ${name} <value>`);
  }
  return argv[i + 1]!;
}

async function postIngest(
  baseUrl: string,
  orgSlug: string,
  secret: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const raw = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const sig = sign(secret, raw, ts);
  const url = `${baseUrl.replace(/\/$/, "")}/v1/webhooks/${orgSlug}/ingest`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Beacon-Timestamp": String(ts),
      "X-Beacon-Signature": sig,
      Accept: "application/json",
    },
    body: raw,
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const mode = argv[0];
  if (mode !== "steady" && mode !== "burst") {
    console.error(
      "Usage: beacon-sim steady|burst --baseUrl URL --orgSlug SLUG --serviceId UUID --secret SECRET\n  burst also requires: --count N",
    );
    process.exit(1);
  }

  const baseUrl = getArg(argv, "--baseUrl");
  const orgSlug = getArg(argv, "--orgSlug");
  const serviceId = getArg(argv, "--serviceId");
  const secret = getArg(argv, "--secret");

  if (mode === "steady") {
    const res = await postIngest(baseUrl, orgSlug, secret, {
      schemaVersion: 1,
      dedupeKey: `sim:${crypto.randomUUID()}`,
      serviceId,
      title: "steady simulator",
      severity: "SEV3",
    });
    const text = await res.text();
    console.log(res.status, text);
    if (!res.ok) process.exit(1);
    return;
  }

  const count = Math.max(1, Number(getArg(argv, "--count")));
  for (let i = 0; i < count; i += 1) {
    const res = await postIngest(baseUrl, orgSlug, secret, {
      schemaVersion: 1,
      dedupeKey: `sim:${crypto.randomUUID()}`,
      serviceId,
      title: `burst ${i}`,
      severity: "SEV2",
    });
    const text = await res.text();
    console.log(i, res.status, text);
    if (!res.ok) process.exitCode = 1;
  }
  if (process.exitCode) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
