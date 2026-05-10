"use client";

import { use, useEffect, useState } from "react";

type IncidentRow = {
  id: string;
  title: string;
  severity: string;
  status: string;
  openedAt: string;
};

export default function OrgIncidentsPage(props: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(props.params);
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [data, setData] = useState<{ incidents?: IncidentRow[]; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`${base}/v1/orgs/${orgSlug}/incidents`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (cancelled) return;
      if (!res.ok) {
        setData({ error: JSON.stringify(json) });
        return;
      }
      setData({ incidents: json.incidents as IncidentRow[] });
    })();
    return () => {
      cancelled = true;
    };
  }, [base, orgSlug]);

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Incidents — {orgSlug}</h1>
      <p style={{ color: "#666" }}>
        Uses your session cookie against <code>{base}</code>. Sign in via{" "}
        <code>POST /v1/auth/login</code> on the API (same browser recommended).
      </p>
      {!data && <p>Loading…</p>}
      {data?.error && <pre style={{ color: "crimson" }}>{data.error}</pre>}
      {data?.incidents && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
              <th>Status</th>
              <th>Severity</th>
              <th>Title</th>
              <th>Opened</th>
            </tr>
          </thead>
          <tbody>
            {data.incidents.map((i) => (
              <tr key={i.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{i.status}</td>
                <td>{i.severity}</td>
                <td>{i.title}</td>
                <td style={{ fontSize: 12 }}>{i.openedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ marginTop: 24 }}>
        <a href="/">Home</a> · <a href={`/public/${orgSlug}/status`}>Public status</a>
      </p>
    </main>
  );
}
