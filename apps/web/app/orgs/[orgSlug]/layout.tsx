import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";

/** Suspense wraps org routes that unwrap async `params` on the client during SSR. */
function OrgMainFallback() {
  return (
    <div className="main-content">
      <div className="empty-state" style={{ height: "100%", minHeight: 280 }}>
        <span className="loading-pulse" style={{ marginBottom: 12 }} />
        <span className="text-secondary">Loading…</span>
      </div>
    </div>
  );
}

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  return (
    <div className="app-shell">
      <Sidebar orgSlug={orgSlug} />
      <Suspense fallback={<OrgMainFallback />}>
        <div className="main-content">{children}</div>
      </Suspense>
    </div>
  );
}
