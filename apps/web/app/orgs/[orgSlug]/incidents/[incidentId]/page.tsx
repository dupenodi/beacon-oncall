"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SeverityBadge, StatusBadge } from "@/components/Badge";
import { API_BASE, fmtDate, relTime } from "@/lib/api";

type Incident = {
  id: string;
  serviceId: string;
  serviceName?: string;
  status: "open" | "acknowledged" | "resolved";
  severity: "SEV1" | "SEV2" | "SEV3" | "SEV4";
  title: string;
  dedupeKey: string | null;
  currentStepIndex: number;
  nextActionAt: string | null;
  openedAt: string;
  ackedAt: string | null;
  resolvedAt: string | null;
  externalRef: string | null;
};

type Event = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  createdAt: string;
};

const EVENT_STYLES: Record<string, { dotClass: string; label: string }> = {
  "incident.opened": { dotClass: "opened", label: "Incident Opened" },
  "incident.acknowledged": { dotClass: "acknowledged", label: "Acknowledged" },
  "incident.resolved": { dotClass: "resolved", label: "Resolved" },
  "notify.sent": { dotClass: "notify-sent", label: "Notification Sent" },
  "notify.failed": { dotClass: "notify-failed", label: "Notification Failed" },
  "escalation.advanced": { dotClass: "escalation", label: "Escalated" },
  "escalation.exhausted": { dotClass: "escalation", label: "Escalation Exhausted" },
};

export default function IncidentDetailPage(props: {
  params: Promise<{ orgSlug: string; incidentId: string }>;
}) {
  const { orgSlug, incidentId } = use(props.params);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [actioning, setActioning] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`${API_BASE}/v1/orgs/${orgSlug}/incidents/${incidentId}`, {
      credentials: "include",
    });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (!res.ok) { setError(`Failed to load (${res.status})`); return; }
    const j = await res.json();
    setIncident(j.incident);
    setEvents(j.timeline ?? []);
  }, [orgSlug, incidentId]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action: "ack" | "resolve") => {
    setActioning(true);
    setActionMsg("");
    const res = await fetch(
      `${API_BASE}/v1/orgs/${orgSlug}/incidents/${incidentId}/${action === "ack" ? "ack" : "resolve"}`,
      { method: "POST", credentials: "include" },
    );
    setActioning(false);
    if (res.ok) {
      await load();
    } else {
      const j = await res.json().catch(() => ({}));
      setActionMsg((j as { error?: string }).error ?? `Failed to ${action}`);
    }
  };

  if (!incident && !error) {
    return (
      <div className="empty-state" style={{ height: "100%" }}>
        <span className="loading-pulse" style={{ marginBottom: 12 }} />
        <span className="text-secondary">Loading incident…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-body">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  if (!incident) return null;

  const isOpen = incident.status === "open";
  const isAcked = incident.status === "acknowledged";

  return (
    <>
      <div className="page-header">
        <div style={{ marginBottom: 14 }}>
          <Link
            href={`/orgs/${orgSlug}/incidents`}
            className="text-xs text-muted"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Incidents
          </Link>
        </div>
        <div className="page-header-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
              <SeverityBadge sev={incident.severity} />
              <StatusBadge status={incident.status} />
              <span className="text-xs text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                #{incident.id.slice(0, 8)}
              </span>
            </div>
            <h1 className="page-title" style={{ fontSize: 17 }}>{incident.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {(isOpen || isAcked) && (
              <Link
                href={`/orgs/${orgSlug}/incidents/${incidentId}/agent`}
                className="btn btn-secondary"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                AI Agent
              </Link>
            )}
            {isOpen && (
              <button
                className="btn btn-secondary"
                disabled={actioning}
                onClick={() => doAction("ack")}
              >
                Acknowledge
              </button>
            )}
            {(isOpen || isAcked) && (
              <button
                className="btn btn-success"
                disabled={actioning}
                onClick={() => doAction("resolve")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Resolve
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        {actionMsg && <div className="alert alert-error">{actionMsg}</div>}

        {/* Meta grid */}
        <div className="detail-meta-grid">
          <div className="detail-meta-cell">
            <div className="detail-meta-label">Opened</div>
            <div className="detail-meta-value">{fmtDate(incident.openedAt)}</div>
          </div>
          {incident.ackedAt && (
            <div className="detail-meta-cell">
              <div className="detail-meta-label">Acknowledged</div>
              <div className="detail-meta-value">{fmtDate(incident.ackedAt)}</div>
            </div>
          )}
          {incident.resolvedAt && (
            <div className="detail-meta-cell">
              <div className="detail-meta-label">Resolved</div>
              <div className="detail-meta-value">{fmtDate(incident.resolvedAt)}</div>
            </div>
          )}
          <div className="detail-meta-cell">
            <div className="detail-meta-label">Step</div>
            <div className="detail-meta-value">Step {incident.currentStepIndex + 1}</div>
          </div>
          {incident.nextActionAt && (
            <div className="detail-meta-cell">
              <div className="detail-meta-label">Next Escalation</div>
              <div className="detail-meta-value" style={{ color: "var(--sev3)" }}>
                {relTime(incident.nextActionAt)}
              </div>
            </div>
          )}
          {incident.dedupeKey && (
            <div className="detail-meta-cell">
              <div className="detail-meta-label">Dedupe Key</div>
              <div className="detail-meta-value text-sm text-muted">{incident.dedupeKey}</div>
            </div>
          )}
          {incident.externalRef && (
            <div className="detail-meta-cell">
              <div className="detail-meta-label">External Ref</div>
              <div className="detail-meta-value text-sm">{incident.externalRef}</div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="two-col-6-4" style={{ alignItems: "start" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              Timeline
            </div>
            {events.length === 0 ? (
              <div className="text-sm text-muted">No events yet.</div>
            ) : (
              <div className="timeline">
                {events.map((ev) => {
                  const style = EVENT_STYLES[ev.type] ?? { dotClass: "", label: ev.type };
                  return (
                    <div key={ev.id} className="timeline-item">
                      <div className={`timeline-dot ${style.dotClass}`} />
                      <div className="timeline-time">{fmtDate(ev.createdAt)}</div>
                      <div className="timeline-type">{style.label}</div>
                      {Object.keys(ev.payload).length > 0 && (
                        <div className="timeline-content">
                          {typeof ev.payload.to_email === "string" && (
                            <span>→ {ev.payload.to_email}</span>
                          )}
                          {ev.payload.step_index !== undefined && (
                            <span> step {String(ev.payload.step_index)}</span>
                          )}
                          {typeof ev.payload.error === "string" && (
                            <span style={{ color: "var(--sev1)" }}> {ev.payload.error}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              Incident ID
            </div>
            <div className="code-block" style={{ fontSize: 11, wordBreak: "break-all" }}>
              {incident.id}
            </div>

            {incident.status !== "resolved" && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  Quick Actions
                </div>
                <div className="flex flex-col gap-2">
                  {isOpen && (
                    <button
                      className="btn btn-secondary"
                      style={{ justifyContent: "flex-start" }}
                      disabled={actioning}
                      onClick={() => doAction("ack")}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Acknowledge
                    </button>
                  )}
                  <button
                    className="btn btn-success"
                    style={{ justifyContent: "flex-start" }}
                    disabled={actioning}
                    onClick={() => doAction("resolve")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Mark Resolved
                  </button>
                  <Link
                    href={`/orgs/${orgSlug}/incidents/${incidentId}/agent`}
                    className="btn btn-secondary"
                    style={{ justifyContent: "flex-start" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    Run AI Agent
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
