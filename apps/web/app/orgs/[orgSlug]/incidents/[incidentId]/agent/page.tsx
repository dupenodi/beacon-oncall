"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/api";

type ActionStep = {
  id: string;
  index: number;
  kind: string;
  toolName: string | null;
  toolInput: Record<string, unknown> | null;
  toolOutput: Record<string, unknown> | null;
  approvalStatus: string;
  stepStatus: string;
};

type ActionRun = {
  id: string;
  status: string;
  modelName: string;
  promptVersion: string;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft_plan: "var(--text-secondary)",
  awaiting_approval: "var(--sev3)",
  executing: "var(--accent)",
  completed: "var(--status-res)",
  failed: "var(--status-open)",
  cancelled: "var(--text-muted)",
};

const APPROVAL_COLORS: Record<string, string> = {
  pending: "var(--sev3)",
  approved: "var(--status-res)",
  rejected: "var(--status-open)",
  not_required: "var(--text-muted)",
};

const STEP_STATUS_COLORS: Record<string, string> = {
  pending: "var(--text-muted)",
  running: "var(--accent)",
  succeeded: "var(--status-res)",
  failed: "var(--status-open)",
};

export default function AgentPage(props: {
  params: Promise<{ orgSlug: string; incidentId: string }>;
}) {
  const { orgSlug, incidentId } = use(props.params);
  const base = `${API_BASE}/v1/orgs/${orgSlug}/incidents/${incidentId}`;

  const [run, setRun] = useState<ActionRun | null>(null);
  const [steps, setSteps] = useState<ActionStep[]>([]);
  const [runId, setRunId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [approveOut, setApproveOut] = useState<Record<string, unknown> | null>(null);

  const createRun = useCallback(async () => {
    setBusy(true);
    setError("");
    setRun(null);
    setSteps([]);
    setApproveOut(null);
    const res = await fetch(`${base}/action-runs`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError((j as { error?: string }).error ?? "Failed to create run");
      setBusy(false);
      return;
    }
    const j = await res.json();
    const id = (j as { runId: string }).runId;
    setRunId(id);
    await loadRun(id);
    setBusy(false);
  }, [base]);

  const loadRun = useCallback(async (id?: string) => {
    const rid = id ?? runId;
    if (!rid) return;
    setBusy(true);
    setError("");
    const res = await fetch(`${base}/action-runs/${rid}`, { credentials: "include" });
    if (!res.ok) {
      setError("Failed to load run");
      setBusy(false);
      return;
    }
    const j = await res.json();
    setRun((j as { run: ActionRun }).run);
    setSteps((j as { steps: ActionStep[] }).steps ?? []);
    setBusy(false);
  }, [base, runId]);

  const approve = useCallback(async () => {
    if (!runId) return;
    setBusy(true);
    setError("");
    setApproveOut(null);
    const res = await fetch(`${base}/action-runs/${runId}/approve`, {
      method: "POST",
      credentials: "include",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((j as { error?: string }).error ?? "Approval failed");
    } else {
      setApproveOut(j as Record<string, unknown>);
      await loadRun();
    }
    setBusy(false);
  }, [base, runId, loadRun]);

  const hasPendingApproval = steps.some((s) => s.approvalStatus === "pending");

  return (
    <>
      <div className="page-header">
        <div style={{ marginBottom: 12 }}>
          <Link
            href={`/orgs/${orgSlug}/incidents/${incidentId}`}
            className="text-xs text-muted"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Incident Detail
          </Link>
        </div>
        <div className="page-header-top">
          <div>
            <h1 className="page-title flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              AI Action Agent
            </h1>
            <p className="page-subtitle">
              Incident <span className="text-accent">{incidentId.slice(0, 12)}…</span> · {orgSlug}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={createRun}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Run Agent
            </button>
            {runId && (
              <button className="btn btn-secondary" disabled={busy} onClick={() => loadRun()}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Refresh
              </button>
            )}
            {runId && hasPendingApproval && (
              <button className="btn btn-success" disabled={busy} onClick={approve}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Approve &amp; Post
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {!run && !busy && (
          <div className="empty-state">
            <svg
              style={{ width: 48, height: 48, marginBottom: 16, opacity: 0.15 }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
            <div className="empty-title">No run yet</div>
            <div className="empty-text" style={{ marginBottom: 20 }}>
              Click "Run Agent" to let AI analyze this incident and propose remediation actions.
            </div>
            <div className="alert alert-info" style={{ maxWidth: 440, textAlign: "left", margin: "0 auto" }}>
              <strong>Note:</strong> GitHub integration must be configured (owner role) before approving.
              Set it in{" "}
              <Link href={`/orgs/${orgSlug}/settings`}>Settings → GitHub</Link>.
            </div>
          </div>
        )}

        {busy && !run && (
          <div className="empty-state">
            <span className="loading-pulse" style={{ marginBottom: 12, width: 12, height: 12 }} />
            <span className="text-secondary">Agent is thinking…</span>
          </div>
        )}

        {run && (
          <>
            {/* Run summary */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <span className="card-title">Run Summary</span>
                <span
                  className="badge"
                  style={{ color: STATUS_COLORS[run.status], background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                >
                  {run.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="card-body">
                <div className="two-col">
                  <div>
                    <div className="detail-meta-label" style={{ marginBottom: 3 }}>Run ID</div>
                    <div className="text-sm text-muted" style={{ fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>
                      {run.id}
                    </div>
                  </div>
                  <div>
                    <div className="detail-meta-label" style={{ marginBottom: 3 }}>Model</div>
                    <div className="text-sm text-secondary">{run.modelName || "—"}</div>
                  </div>
                </div>

                {/* Run ID input for manual entry */}
                {!run && (
                  <div className="flex gap-2" style={{ marginTop: 12 }}>
                    <input
                      className="form-input"
                      placeholder="Paste run ID…"
                      value={runId}
                      onChange={(e) => setRunId(e.target.value)}
                    />
                    <button className="btn btn-secondary" disabled={busy || !runId} onClick={() => loadRun()}>
                      Load
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Steps */}
            {steps.length > 0 && (
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                  Proposed Steps ({steps.length})
                </div>
                {steps.map((step) => (
                  <div key={step.id} className="agent-step">
                    <div className="agent-step-header">
                      <div className="flex items-center gap-2">
                        <span className="agent-step-index">Step {step.index + 1}</span>
                        <span
                          className="badge badge-neutral"
                          style={{ textTransform: "uppercase", fontSize: 9.5 }}
                        >
                          {step.kind}
                        </span>
                        {step.toolName && (
                          <span className="text-xs text-accent">{step.toolName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs"
                          style={{ color: APPROVAL_COLORS[step.approvalStatus] ?? "var(--text-muted)" }}
                        >
                          approval: {step.approvalStatus}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: STEP_STATUS_COLORS[step.stepStatus] ?? "var(--text-muted)" }}
                        >
                          · {step.stepStatus}
                        </span>
                      </div>
                    </div>

                    {step.toolInput && (
                      <div>
                        <div className="detail-meta-label" style={{ marginBottom: 4 }}>Input</div>
                        <div className="code-block" style={{ maxHeight: 200, overflow: "auto" }}>
                          {JSON.stringify(step.toolInput, null, 2)}
                        </div>
                      </div>
                    )}

                    {step.toolOutput && (
                      <div style={{ marginTop: 10 }}>
                        <div className="detail-meta-label" style={{ marginBottom: 4 }}>Output</div>
                        <div className="code-block" style={{ maxHeight: 200, overflow: "auto" }}>
                          {JSON.stringify(step.toolOutput, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Approve output */}
            {approveOut && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                  Approval Result
                </div>
                <div className="alert alert-success" style={{ marginBottom: 8 }}>
                  Comment posted successfully.
                  {typeof approveOut.html_url === "string" && (
                    <>
                      {" "}
                      <a href={approveOut.html_url} target="_blank" rel="noopener noreferrer">
                        View on GitHub ↗
                      </a>
                    </>
                  )}
                </div>
                <div className="code-block">{JSON.stringify(approveOut, null, 2)}</div>
              </div>
            )}
          </>
        )}

        {/* Run ID manual input when no run loaded */}
        {!run && !busy && (
          <div style={{ marginTop: 24, maxWidth: 440 }}>
            <div className="detail-meta-label" style={{ marginBottom: 8 }}>Or load existing run by ID</div>
            <div className="flex gap-2">
              <input
                className="form-input"
                placeholder="Paste run ID…"
                value={runId}
                onChange={(e) => setRunId(e.target.value)}
              />
              <button className="btn btn-secondary" disabled={busy || !runId} onClick={() => loadRun()}>
                Load
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
