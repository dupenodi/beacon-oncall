"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SeverityBadge, StatusBadge } from "@/components/Badge";
import { API_BASE, relTime, fmtDate } from "@/lib/api";

type Incident = {
  id: string;
  serviceId: string;
  serviceName: string;
  status: "open" | "acknowledged" | "resolved";
  severity: "SEV1" | "SEV2" | "SEV3" | "SEV4";
  title: string;
  dedupeKey: string | null;
  currentStepIndex: number;
  nextActionAt: string | null;
  openedAt: string;
  ackedAt: string | null;
  resolvedAt: string | null;
};

type Service = { id: string; name: string; severity: string };

type Filter = "all" | "open" | "acknowledged" | "resolved";

function CreateModal({
  orgSlug,
  services,
  onClose,
  onCreated,
}: {
  orgSlug: string;
  services: Service[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: "", serviceId: "", severity: "SEV3" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.title || !form.serviceId) { setErr("Title and service are required"); return; }
    setBusy(true);
    setErr("");
    const res = await fetch(`${API_BASE}/v1/orgs/${orgSlug}/incidents`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr((j as { error?: string }).error ?? "Failed to create incident");
      return;
    }
    onCreated();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width: 460, maxWidth: "calc(100vw - 40px)" }}>
        <div className="card-header">
          <span className="card-title">Open Incident</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="card-body">
          {err && <div className="alert alert-error">{err}</div>}

          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              placeholder="Describe what's happening…"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="two-col">
            <div className="form-group">
              <label className="form-label">Service</label>
              <select
                className="form-select"
                value={form.serviceId}
                onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
              >
                <option value="">Select service…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Severity</label>
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
          </div>

          <div className="flex justify-end gap-2" style={{ marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={busy || !form.title || !form.serviceId}
              onClick={submit}
            >
              {busy ? "Opening…" : "Open Incident"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IncidentsPage(props: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(props.params);
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const url = `${API_BASE}/v1/orgs/${orgSlug}/incidents`;
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (!res.ok) { setError(`Failed to load (${res.status})`); return; }
    const j = await res.json();
    setIncidents(j.incidents ?? []);
  }, [orgSlug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`${API_BASE}/v1/orgs/${orgSlug}/services`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setServices((j as { services?: Service[] }).services ?? []))
      .catch(() => {});
  }, [orgSlug]);

  const filtered = (incidents ?? []).filter((i) => filter === "all" || i.status === filter);

  const counts = {
    open: (incidents ?? []).filter((i) => i.status === "open").length,
    acknowledged: (incidents ?? []).filter((i) => i.status === "acknowledged").length,
    resolved: (incidents ?? []).filter((i) => i.status === "resolved").length,
  };

  const sevOrder: Record<string, number> = { SEV1: 0, SEV2: 1, SEV3: 2, SEV4: 3 };
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "open" && b.status !== "open") return -1;
    if (b.status === "open" && a.status !== "open") return 1;
    return (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
  });

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Incidents</h1>
            <p className="page-subtitle">All incidents for {orgSlug}</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Open Incident
          </button>
        </div>
        <div className="tabs">
          {(["all", "open", "acknowledged", "resolved"] as const).map((t) => (
            <button
              key={t}
              className={`tab-btn ${filter === t ? "active" : ""}`}
              onClick={() => setFilter(t)}
            >
              {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
              {t !== "all" && (
                <span className="tab-count">{counts[t]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {!incidents && !error && (
          <div className="empty-state">
            <span className="loading-pulse" style={{ marginBottom: 12 }} />
            <span className="text-secondary">Loading incidents…</span>
          </div>
        )}

        {incidents && sorted.length === 0 && (
          <div className="empty-state">
            <svg
              style={{ width: 44, height: 44, marginBottom: 16, opacity: 0.2 }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="empty-title">No incidents</div>
            <div className="empty-text">
              {filter === "all"
                ? "No incidents yet. Open one when something needs attention."
                : `No ${filter} incidents.`}
            </div>
          </div>
        )}

        {sorted.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Status</th>
                  <th style={{ width: "38%" }}>Title</th>
                  <th>Service</th>
                  <th>Opened</th>
                  <th>Next escalation</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((incident) => (
                  <tr
                    key={incident.id}
                    className="clickable"
                    onClick={() => router.push(`/orgs/${orgSlug}/incidents/${incident.id}`)}
                  >
                    <td><SeverityBadge sev={incident.severity} /></td>
                    <td><StatusBadge status={incident.status} /></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{incident.title}</div>
                      {incident.dedupeKey && (
                        <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                          dedupe: {incident.dedupeKey}
                        </div>
                      )}
                    </td>
                    <td className="text-secondary text-sm">{incident.serviceName || "—"}</td>
                    <td>
                      <div className="text-sm text-muted">{relTime(incident.openedAt)}</div>
                      <div className="text-xs text-muted">{fmtDate(incident.openedAt)}</div>
                    </td>
                    <td>
                      {incident.nextActionAt ? (
                        <span className="text-sm" style={{ color: "var(--sev3)" }}>
                          {relTime(incident.nextActionAt)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          orgSlug={orgSlug}
          services={services}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </>
  );
}
