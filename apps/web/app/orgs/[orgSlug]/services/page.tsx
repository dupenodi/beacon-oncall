"use client";

import { use, useCallback, useEffect, useState } from "react";
import { SeverityBadge } from "@/components/Badge";
import { API_BASE, fmtDate } from "@/lib/api";

type Service = {
  id: string;
  name: string;
  description: string | null;
  severity: string;
  createdAt: string;
};

type Policy = { id: string; name: string };

function CreateModal({
  orgSlug,
  onClose,
  onCreated,
}: {
  orgSlug: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: "", description: "", severity: "SEV3" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.name.trim()) { setErr("Name is required"); return; }
    setBusy(true);
    setErr("");
    const res = await fetch(`${API_BASE}/v1/orgs/${orgSlug}/services`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, description: form.description || undefined, severity: form.severity }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr((j as { error?: string }).error ?? "Failed");
      return;
    }
    onCreated();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width: 440, maxWidth: "calc(100vw - 40px)" }}>
        <div className="card-header">
          <span className="card-title">Add Service</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="card-body">
          {err && <div className="alert alert-error">{err}</div>}
          <div className="form-group">
            <label className="form-label">Service Name</label>
            <input
              className="form-input"
              placeholder="e.g. Payment API"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <input
              className="form-input"
              placeholder="What does this service do?"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Default Severity</label>
            <select
              className="form-select"
              value={form.severity}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
            >
              <option value="SEV1">SEV1 — Critical</option>
              <option value="SEV2">SEV2 — High</option>
              <option value="SEV3">SEV3 — Medium</option>
              <option value="SEV4">SEV4 — Low</option>
            </select>
          </div>
          <div className="flex justify-end gap-2" style={{ marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || !form.name.trim()} onClick={submit}>
              {busy ? "Creating…" : "Add Service"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignPolicyModal({
  orgSlug,
  service,
  policies,
  onClose,
  onAssigned,
}: {
  orgSlug: string;
  service: Service;
  policies: Policy[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [policyId, setPolicyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!policyId) { setErr("Select a policy"); return; }
    setBusy(true);
    const res = await fetch(`${API_BASE}/v1/orgs/${orgSlug}/services/${service.id}/policy`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId }),
    });
    setBusy(false);
    if (!res.ok) { setErr("Failed"); return; }
    onAssigned();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width: 380, maxWidth: "calc(100vw - 40px)" }}>
        <div className="card-header">
          <span className="card-title">Assign Policy</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="card-body">
          {err && <div className="alert alert-error">{err}</div>}
          <div className="text-sm text-secondary" style={{ marginBottom: 14 }}>
            Assign escalation policy to <strong style={{ color: "var(--text-primary)" }}>{service.name}</strong>
          </div>
          <div className="form-group">
            <label className="form-label">Escalation Policy</label>
            <select className="form-select" value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
              <option value="">Select policy…</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || !policyId} onClick={submit}>
              {busy ? "Assigning…" : "Assign"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage(props: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(props.params);
  const [services, setServices] = useState<Service[] | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Service | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`${API_BASE}/v1/orgs/${orgSlug}/services`, { credentials: "include" });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (!res.ok) { setError("Failed to load services"); return; }
    const j = await res.json();
    setServices((j as { services: Service[] }).services ?? []);
  }, [orgSlug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`${API_BASE}/v1/orgs/${orgSlug}/policies`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setPolicies((j as { policies?: Policy[] }).policies ?? []))
      .catch(() => {});
  }, [orgSlug]);

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Services</h1>
            <p className="page-subtitle">Monitored services and their escalation policies</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Service
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {!services && !error && (
          <div className="empty-state">
            <span className="loading-pulse" style={{ marginBottom: 12 }} />
            <span className="text-secondary">Loading services…</span>
          </div>
        )}

        {services && services.length === 0 && (
          <div className="empty-state">
            <svg style={{ width: 44, height: 44, marginBottom: 16, opacity: 0.2 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
            <div className="empty-title">No services yet</div>
            <div className="empty-text">Add a service to start monitoring it.</div>
          </div>
        )}

        {services && services.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Default Severity</th>
                <th>Created</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    {s.description && (
                      <div className="text-xs text-muted" style={{ marginTop: 2 }}>{s.description}</div>
                    )}
                    <div className="text-xs text-muted" style={{ marginTop: 2, fontFamily: "var(--font-mono)" }}>
                      {s.id.slice(0, 8)}…
                    </div>
                  </td>
                  <td><SeverityBadge sev={s.severity} /></td>
                  <td className="text-sm text-muted">{fmtDate(s.createdAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setAssignTarget(s)}
                    >
                      Assign Policy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateModal
          orgSlug={orgSlug}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {assignTarget && (
        <AssignPolicyModal
          orgSlug={orgSlug}
          service={assignTarget}
          policies={policies}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => { setAssignTarget(null); load(); }}
        />
      )}
    </>
  );
}
