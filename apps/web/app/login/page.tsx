"use client";

import { useState } from "react";
import { API_BASE } from "@/lib/api";

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
      setError("Could not connect to API. Is it running?");
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
            <div className="login-sub">Incident Management Platform</div>
          </div>
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
            <label className="form-label" htmlFor="org">Organization Slug</label>
            <input
              id="org"
              type="text"
              className="form-input"
              placeholder="your-org"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              required
            />
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

        <div style={{ marginTop: 24, padding: "14px 16px", background: "var(--bg-elevated)", borderRadius: "var(--r)", border: "1px solid var(--border)" }}>
          <div className="text-xs text-muted" style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Demo Credentials</div>
          <div className="text-sm text-secondary">
            <div>owner@demo.invalid / <span className="text-accent">demo</span></div>
            <div>oncall@demo.invalid / <span className="text-accent">demo</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
