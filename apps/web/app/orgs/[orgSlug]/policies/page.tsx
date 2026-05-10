"use client";

import { use, useCallback, useEffect, useState } from "react";
import { API_BASE, fmtDate } from "@/lib/api";

type Policy = { id: string; name: string; createdAt: string };
type User = { id: string; email: string };

type StepForm = { waitSeconds: string; notifyUserId: string };

function CreateModal({
  orgSlug,
  users,
  onClose,
  onCreated,
}: {
  orgSlug: string;
  users: User[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<StepForm[]>([{ waitSeconds: "300", notifyUserId: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const addStep = () => setSteps((s) => [...s, { waitSeconds: "300", notifyUserId: "" }]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: keyof StepForm, val: string) =>
    setSteps((s) => s.map((step, idx) => (idx === i ? { ...step, [field]: val } : step)));

  const submit = async () => {
    if (!name.trim()) { setErr("Policy name required"); return; }
    if (steps.some((s) => !s.notifyUserId)) { setErr("All steps must have a user selected"); return; }
    setBusy(true);
    setErr("");
    const res = await fetch(`${API_BASE}/v1/orgs/${orgSlug}/policies`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        steps: steps.map((s) => ({
          waitSeconds: Number(s.waitSeconds),
          notifyUserId: s.notifyUserId,
        })),
      }),
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
      <div className="card" style={{ width: 520, maxWidth: "calc(100vw - 40px)" }}>
        <div className="card-header">
          <span className="card-title">Create Escalation Policy</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="card-body">
          {err && <div className="alert alert-error">{err}</div>}

          <div className="form-group">
            <label className="form-label">Policy Name</label>
            <input
              className="form-input"
              placeholder="e.g. Default On-call"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div className="form-label" style={{ marginBottom: 10 }}>Escalation Steps</div>
            {steps.map((step, i) => (
              <div
                key={i}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r)",
                  padding: "12px 14px",
                  marginBottom: 8,
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <span className="text-xs text-muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Step {i + 1}
                  </span>
                  {steps.length > 1 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => removeStep(i)}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="two-col">
                  <div>
                    <label className="form-label">Wait (seconds)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      value={step.waitSeconds}
                      onChange={(e) => updateStep(i, "waitSeconds", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Notify User</label>
                    <select
                      className="form-select"
                      value={step.notifyUserId}
                      onChange={(e) => updateStep(i, "notifyUserId", e.target.value)}
                    >
                      <option value="">Select user…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.email}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={addStep}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Step
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={submit}>
              {busy ? "Creating…" : "Create Policy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PoliciesPage(props: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(props.params);
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`${API_BASE}/v1/orgs/${orgSlug}/policies`, { credentials: "include" });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (!res.ok) { setError("Failed to load"); return; }
    const j = await res.json();
    setPolicies((j as { policies: Policy[] }).policies ?? []);
  }, [orgSlug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Populate notify-user dropdown from the signed-in session until a members API exists.
    fetch(`${API_BASE}/v1/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        const u = (j as { user?: { id: string; email: string } }).user;
        if (u) setUsers([u]);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Escalation Policies</h1>
            <p className="page-subtitle">Who gets notified, and when, while an incident is open</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Policy
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {!policies && !error && (
          <div className="empty-state">
            <span className="loading-pulse" style={{ marginBottom: 12 }} />
            <span className="text-secondary">Loading policies…</span>
          </div>
        )}

        {policies && policies.length === 0 && (
          <div className="empty-state">
            <svg style={{ width: 44, height: 44, marginBottom: 16, opacity: 0.2 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
            <div className="empty-title">No escalation policies</div>
            <div className="empty-text">Create a policy, then attach it to each service you monitor.</div>
          </div>
        )}

        {policies && policies.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Policy Name</th>
                <th>ID</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td className="text-xs text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                    {p.id.slice(0, 12)}…
                  </td>
                  <td className="text-sm text-muted">{fmtDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="alert alert-info" style={{ marginTop: 24, maxWidth: 560 }}>
          When an incident opens, the first person on this policy is notified. If it stays open, the next person is
          notified after each wait time. When everyone on the chain has been reached, paging stops for that incident.
        </div>
      </div>

      {showCreate && (
        <CreateModal
          orgSlug={orgSlug}
          users={users}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </>
  );
}
