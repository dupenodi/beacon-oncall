"use client";

import { use, useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export default function SettingsPage(props: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(props.params);

  // Webhook secret
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [rotatingSecret, setRotatingSecret] = useState(false);
  const [secretError, setSecretError] = useState("");

  // GitHub integration
  const [ghConfigured, setGhConfigured] = useState<boolean | null>(null);
  const [ghDefaultRepo, setGhDefaultRepo] = useState<string | null>(null);
  const [ghForm, setGhForm] = useState({ pat: "", defaultRepo: "" });
  const [savingGh, setSavingGh] = useState(false);
  const [ghError, setGhError] = useState("");
  const [ghSuccess, setGhSuccess] = useState("");

  const loadGithub = useCallback(async () => {
    const res = await fetch(`${API_BASE}/v1/orgs/${orgSlug}/integrations/github`, { credentials: "include" });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (!res.ok) return;
    const j = await res.json();
    setGhConfigured((j as { configured: boolean }).configured);
    setGhDefaultRepo((j as { defaultRepo?: string | null }).defaultRepo ?? null);
  }, [orgSlug]);

  useEffect(() => { loadGithub(); }, [loadGithub]);

  const rotateSecret = async () => {
    setRotatingSecret(true);
    setSecretError("");
    setWebhookSecret(null);
    const res = await fetch(`${API_BASE}/v1/orgs/${orgSlug}/webhook-secret/rotate`, {
      method: "POST",
      credentials: "include",
    });
    setRotatingSecret(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSecretError((j as { error?: string }).error ?? "Not authorized (owner only)");
      return;
    }
    const j = await res.json();
    setWebhookSecret((j as { secretPlaintextOnce: string }).secretPlaintextOnce);
  };

  const saveGithub = async () => {
    setSavingGh(true);
    setGhError("");
    setGhSuccess("");
    const res = await fetch(`${API_BASE}/v1/orgs/${orgSlug}/integrations/github`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pat: ghForm.pat, defaultRepo: ghForm.defaultRepo }),
    });
    setSavingGh(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setGhError((j as { error?: string }).error ?? "Failed (owner only)");
      return;
    }
    setGhSuccess("GitHub connection saved.");
    setGhForm({ pat: "", defaultRepo: "" });
    await loadGithub();
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Webhooks and GitHub</p>
          </div>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 700 }}>
        {/* Webhook Secret */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Webhook Secret</span>
            <span className="badge badge-neutral">Owner only</span>
          </div>
          <div className="card-body">
            <p className="text-sm text-secondary" style={{ marginBottom: 14, lineHeight: 1.7 }}>
              Systems that call your ingest URL must sign requests with this secret. If you rotate it, update them
              right away — the new value is shown only once.
            </p>

            {secretError && <div className="alert alert-error">{secretError}</div>}

            {webhookSecret && (
              <div style={{ marginBottom: 14 }}>
                <div className="form-label" style={{ marginBottom: 6 }}>New Secret (copy now — shown once)</div>
                <div
                  className="code-block"
                  style={{
                    color: "var(--accent)",
                    fontWeight: 600,
                    fontSize: 13,
                    letterSpacing: "0.02em",
                    wordBreak: "break-all",
                  }}
                >
                  {webhookSecret}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <div className="form-label" style={{ marginBottom: 4 }}>Webhook Endpoint</div>
              <div className="code-block" style={{ color: "var(--text-secondary)" }}>
                POST {API_BASE}/v1/webhooks/{orgSlug}/ingest
              </div>
            </div>

            <div className="form-label" style={{ marginBottom: 4 }}>Required Headers</div>
            <div className="code-block" style={{ marginBottom: 14 }}>
              {`X-Beacon-Timestamp: <unix_epoch>\nX-Beacon-Signature: v1=<hmac_sha256_hex>`}
            </div>

            <button
              className="btn btn-secondary"
              disabled={rotatingSecret}
              onClick={rotateSecret}
            >
              {rotatingSecret ? "Rotating…" : "Rotate Webhook Secret"}
            </button>
          </div>
        </div>

        {/* GitHub Integration */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--text-secondary)">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="card-title">GitHub Integration</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-neutral">Owner only</span>
              {ghConfigured !== null && (
                <span className={`badge ${ghConfigured ? "badge-resolved" : "badge-neutral"}`}>
                  {ghConfigured ? "Configured" : "Not configured"}
                </span>
              )}
            </div>
          </div>
          <div className="card-body">
            <p className="text-sm text-secondary" style={{ marginBottom: 14, lineHeight: 1.7 }}>
              Lets Beacon post comments on GitHub issues when you approve a step. Use a personal access token with{" "}
              <code style={{ color: "var(--accent)", fontSize: 12 }}>repo</code> access to the repository below.
            </p>

            {ghConfigured && ghDefaultRepo && (
              <div className="alert alert-info" style={{ marginBottom: 14 }}>
                Currently configured for <strong>{ghDefaultRepo}</strong>. Enter new credentials to update.
              </div>
            )}

            {ghError && <div className="alert alert-error">{ghError}</div>}
            {ghSuccess && <div className="alert alert-success">{ghSuccess}</div>}

            <div className="form-group">
              <label className="form-label">Personal Access Token</label>
              <input
                className="form-input"
                type="password"
                placeholder="ghp_…"
                value={ghForm.pat}
                onChange={(e) => setGhForm((f) => ({ ...f, pat: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Default Repository</label>
              <input
                className="form-input"
                placeholder="owner/repo"
                value={ghForm.defaultRepo}
                onChange={(e) => setGhForm((f) => ({ ...f, defaultRepo: e.target.value }))}
              />
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                e.g. <span className="text-accent">your-org/your-repo</span>
              </div>
            </div>
            <button
              className="btn btn-primary"
              disabled={savingGh || !ghForm.pat || !ghForm.defaultRepo}
              onClick={saveGithub}
            >
              {savingGh ? "Saving…" : "Save GitHub Integration"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
