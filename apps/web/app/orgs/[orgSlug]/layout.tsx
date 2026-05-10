import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";

/**
 * Client pages under /orgs/* use `use(params)` with a Promise. Next/React need a
 * Suspense ancestor during SSR/prerender; without it, Vercel can return 500
 * (FUNCTION_INVOCATION_FAILED) for those routes.
 */
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
