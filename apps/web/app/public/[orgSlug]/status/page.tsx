import { fmtDate } from "@/lib/api";

type ActiveIncident = {
  id: string;
  title: string;
  severity: string;
  status: string;
  openedAt: string;
};

type ResolvedIncident = {
  id: string;
  title: string;
  severity: string;
  resolvedAt: string;
};

type StatusData = {
  org: { slug: string; name: string };
  active: ActiveIncident[];
  recentResolved: ResolvedIncident[];
};

const SEV_LABEL: Record<string, string> = {
  SEV1: "Critical",
  SEV2: "High",
  SEV3: "Medium",
  SEV4: "Low",
};

function BeaconIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" />
    </svg>
  );
}

export default async function PublicStatusPage(props: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await props.params;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  let res: Response;
  try {
    res = await fetch(`${base}/public/${orgSlug}/status`, { cache: "no-store" });
  } catch {
    return (
      <div className="status-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-secondary)" }}>
            Status could not be loaded
          </div>
          <div className="text-sm text-muted" style={{ marginTop: 8 }}>
            Try again in a moment.
          </div>
        </div>
      </div>
    );
  }

  if (!res.ok) {
    return (
      <div className="status-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-secondary)" }}>
            Status page not found
          </div>
          <div className="text-sm text-muted" style={{ marginTop: 8 }}>
            Check the link or ask the team that shared it.
          </div>
        </div>
      </div>
    );
  }

  const data = (await res.json()) as StatusData;
  const hasActive = data.active.length > 0;
  const worstSev = hasActive
    ? data.active.reduce((worst, i) => {
        const order: Record<string, number> = { SEV1: 0, SEV2: 1, SEV3: 2, SEV4: 3 };
        return (order[i.severity] ?? 9) < (order[worst] ?? 9) ? i.severity : worst;
      }, "SEV4")
    : null;

  const systemStatus = !hasActive ? "operational" : worstSev === "SEV1" || worstSev === "SEV2" ? "critical" : "degraded";
  const statusLabel = { operational: "All Systems Operational", degraded: "Partial Degradation", critical: "Major Outage" }[systemStatus];

  const sevColor: Record<string, string> = {
    SEV1: "#FF453A",
    SEV2: "#FF9500",
    SEV3: "#FFD60A",
    SEV4: "#32D74B",
  };

  return (
    <div className="status-page">
      {/* Header */}
      <div className="status-hero">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: "var(--accent)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BeaconIcon />
          </div>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-secondary)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {data.org.name || data.org.slug}
          </span>
        </div>

        <div className="status-system-name">Service status</div>

        <div className={`status-pill ${systemStatus}`}>
          <span className="status-pill-dot" />
          {statusLabel}
        </div>

        <div
          style={{
            marginTop: 16,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: "var(--text-muted)",
          }}
        >
          Last updated: {new Date().toLocaleString("en-US", { timeZoneName: "short" })}
        </div>
      </div>

      <div className="status-content">
        {/* Active incidents */}
        {hasActive && (
          <div style={{ marginBottom: 36 }}>
            <div className="status-section-label">
              Active Incidents ({data.active.length})
            </div>
            {data.active.map((inc) => (
              <div key={inc.id} className={`status-incident-card ${inc.severity}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>
                    {inc.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        color: sevColor[inc.severity],
                        background: `${sevColor[inc.severity]}18`,
                        border: `1px solid ${sevColor[inc.severity]}40`,
                        borderRadius: 4,
                        padding: "2px 6px",
                      }}
                    >
                      {inc.severity} — {SEV_LABEL[inc.severity]}
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      Opened {fmtDate(inc.openedAt)}
                    </span>
                  </div>
                </div>
                <span
                  className="badge badge-open"
                  style={{ flexShrink: 0 }}
                >
                  {inc.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Operational message */}
        {!hasActive && (
          <div
            style={{
              background: "rgba(50,215,75,0.06)",
              border: "1px solid rgba(50,215,75,0.2)",
              borderRadius: "var(--r)",
              padding: "20px 24px",
              marginBottom: 36,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--status-res)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--status-res)" }}>
                No active incidents
              </div>
              <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                All systems are operating normally.
              </div>
            </div>
          </div>
        )}

        {/* Recent resolved */}
        {data.recentResolved.length > 0 && (
          <div>
            <div className="status-section-label">Recently Resolved</div>
            {data.recentResolved.map((inc) => (
              <div key={inc.id} className={`status-incident-card ${inc.severity}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 13.5,
                      color: "var(--text-secondary)",
                      marginBottom: 3,
                    }}
                  >
                    {inc.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {inc.severity} · Resolved {fmtDate(inc.resolvedAt)}
                  </div>
                </div>
                <span className="badge badge-resolved" style={{ flexShrink: 0 }}>resolved</span>
              </div>
            ))}
          </div>
        )}

        {data.recentResolved.length === 0 && !hasActive && (
          <div>
            <div className="status-section-label">Recent History</div>
            <div className="text-sm text-muted">No recent incidents.</div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 20,
                height: 20,
                background: "var(--accent)",
                borderRadius: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" />
              </svg>
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-muted)" }}>
              Status by Beacon
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {data.org.slug}
          </span>
        </div>
      </div>
    </div>
  );
}
