export function SeverityBadge({ sev }: { sev: string }) {
  const dots: Record<string, string> = {
    SEV1: "#FF453A",
    SEV2: "#FF9500",
    SEV3: "#FFD60A",
    SEV4: "#32D74B",
  };
  return (
    <span className={`badge badge-${sev}`}>
      <span className="badge-dot" style={{ background: dots[sev] ?? "#8B949E" }} />
      {sev}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>;
}
