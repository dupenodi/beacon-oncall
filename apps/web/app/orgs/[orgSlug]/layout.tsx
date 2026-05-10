import Sidebar from "@/components/Sidebar";

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
      <div className="main-content">{children}</div>
    </div>
  );
}
