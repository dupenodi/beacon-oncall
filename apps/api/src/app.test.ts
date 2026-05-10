import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("createApp", () => {
  it("GET /health returns ok", async () => {
    const app = createApp();
    const res = await app.request("http://localhost/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("beacon-api");
  });

  it("GET /health/db without DATABASE_URL returns 503", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const app = createApp();
    const res = await app.request("http://localhost/health/db");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  });

  it("POST /v1/auth/login with invalid email returns 400", async () => {
    const app = createApp();
    const res = await app.request("http://localhost/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /v1/orgs/demo/me without session returns 401", async () => {
    const app = createApp();
    const res = await app.request("http://localhost/v1/orgs/demo/me");
    expect(res.status).toBe(401);
  });

  it("GET /v1/orgs/demo/incidents without session returns 401", async () => {
    const app = createApp();
    const res = await app.request("http://localhost/v1/orgs/demo/incidents");
    expect(res.status).toBe(401);
  });
});
