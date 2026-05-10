"use client";

import { use, useCallback, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function AgentPage(props: {
  params: Promise<{ orgSlug: string; incidentId: string }>;
}) {
  const { orgSlug, incidentId } = use(props.params);
  const [runId, setRunId] = useState("");
  const [detail, setDetail] = useState<string>("");
  const [approveOut, setApproveOut] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const base = `${api}/v1/orgs/${orgSlug}/incidents/${incidentId}`;

  const createRun = useCallback(async () => {
    setBusy(true);
    setDetail("");
    try {
      const res = await fetch(`${base}/action-runs`, {
        method: "POST",
        credentials: "include",
      });
      const text = await res.text();
      if (!res.ok) {
        setDetail(text);
        return;
      }
      const j = JSON.parse(text) as { runId: string };
      setRunId(j.runId);
      setDetail(text);
    } finally {
      setBusy(false);
    }
  }, [base]);

  const loadRun = useCallback(async () => {
    if (!runId) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/action-runs/${runId}`, { credentials: "include" });
      setDetail(await res.text());
    } finally {
      setBusy(false);
    }
  }, [base, runId]);

  const approve = useCallback(async () => {
    if (!runId) return;
    setBusy(true);
    setApproveOut("");
    try {
      const res = await fetch(`${base}/action-runs/${runId}/approve`, {
        method: "POST",
        credentials: "include",
      });
      setApproveOut(await res.text());
    } finally {
      setBusy(false);
    }
  }, [base, runId]);

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Action agent</h1>
      <p style={{ color: "#666" }}>
        Org <code>{orgSlug}</code> · incident <code>{incidentId}</code>
      </p>
      <p style={{ fontSize: 14 }}>
        Configure GitHub (owner): <code>PUT {api}/v1/orgs/{orgSlug}/integrations/github</code> with{" "}
        <code>pat</code> + <code>defaultRepo</code> before approve.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <button type="button" disabled={busy} onClick={createRun}>
          Create action run
        </button>
        <input
          placeholder="runId"
          value={runId}
          onChange={(e) => setRunId(e.target.value)}
          style={{ flex: 1, minWidth: 240, padding: 8 }}
        />
        <button type="button" disabled={busy} onClick={loadRun}>
          Load run
        </button>
        <button type="button" disabled={busy} onClick={approve}>
          Approve + post comment
        </button>
      </div>
      <h2 style={{ fontSize: 16 }}>Run JSON</h2>
      <pre
        style={{
          background: "#111",
          color: "#ddd",
          padding: 12,
          borderRadius: 8,
          fontSize: 12,
          overflow: "auto",
        }}
      >
        {detail || "—"}
      </pre>
      <h2 style={{ fontSize: 16 }}>Approve response</h2>
      <pre style={{ background: "#1a1a2e", color: "#cfc", padding: 12, borderRadius: 8, fontSize: 12 }}>
        {approveOut || "—"}
      </pre>
      <p style={{ marginTop: 24 }}>
        <a href={`/orgs/${orgSlug}/incidents`}>Back to incidents</a> · <a href="/">Home</a>
      </p>
    </main>
  );
}
