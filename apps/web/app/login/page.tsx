"use client";

import { useState } from "react";
import { API_BASE } from "@/lib/api";

/** Matches `packages/db` seed defaults (`DEMO_SEED_PASSWORD` overrides password). */
const DEMO = {
  orgSlug: "demo",
  password: "demo",
  ownerEmail: "owner@demo.invalid",
  oncallEmail: "oncall@demo.invalid",
} as const;

function BeaconIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgSlug, setOrgSlug] = useState("demo");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: { message?: string } | string };
        const errVal = j.error;
        const msg = typeof errVal === "string"
          ? errVal
          : (errVal as { message?: string })?.message ?? "Invalid credentials";
        setError(msg);
        return;
      }
      window.location.href = `/orgs/${orgSlug}/incidents`;
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-grid" />
      <div className="login-radial" />

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <BeaconIcon />
          </div>
          <div>
            <div className="login-heading">Beacon</div>
            <div className="login-sub">On-call alerting, escalation, and incident response</div>
          </div>
        </div>

        <div className="login-demo">
          <div className="login-demo-title">Seeded demo</div>
          <p className="login-demo-note">
            Works after <span className="text-muted">db:seed</span> (local or hosted). Org{" "}
            <strong className="text-muted">{DEMO.orgSlug}</strong>, password{" "}
            <strong className="text-muted">{DEMO.password}</strong> unless the deploy set{" "}
            <span className="text-muted">DEMO_SEED_PASSWORD</span>.
          </p>
          <div className="login-demo-row">
            <button
              type="button"
              className="login-demo-pill"
              onClick={() => {
                setEmail(DEMO.ownerEmail);
                setPassword(DEMO.password);
                setOrgSlug(DEMO.orgSlug);
              }}
            >
              Owner (admin)
            </button>
            <button
              type="button"
              className="login-demo-pill"
              onClick={() => {
                setEmail(DEMO.oncallEmail);
                setPassword(DEMO.password);
                setOrgSlug(DEMO.orgSlug);
              }}
            >
              On-call (member)
            </button>
          </div>
          <p className="login-demo-meta">
            {DEMO.ownerEmail} · {DEMO.oncallEmail}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="org">Organization</label>
            <input
              id="org"
              type="text"
              className="form-input"
              placeholder="your-workspace"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              required
              autoCapitalize="none"
              spellCheck={false}
            />
            <div className="text-xs text-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Same value as in your Beacon link after <span className="text-muted">/orgs/</span> — ask your admin if
              you are unsure.
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-pulse" />
                Signing in…
              </>
            ) : (
              "Sign in →"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
