import { redirect } from "next/navigation";

export default async function OrgPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  redirect(`/orgs/${orgSlug}/incidents`);
}
