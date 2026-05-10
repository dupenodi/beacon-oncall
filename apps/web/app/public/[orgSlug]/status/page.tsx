type Props = { params: Promise<{ orgSlug: string }> };

export default async function PublicStatusPage(props: Props) {
  const { orgSlug } = await props.params;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const res = await fetch(`${base}/public/${orgSlug}/status`, { cache: "no-store" });
  const body = res.ok ? ((await res.json()) as Record<string, unknown>) : { error: await res.text() };

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Status — {orgSlug}</h1>
      <p style={{ color: "#666" }}>
        Public read-only data from <code>{base}/public/{orgSlug}/status</code>
      </p>
      <pre
        style={{
          background: "#111",
          color: "#e6e6e6",
          padding: 16,
          borderRadius: 8,
          overflow: "auto",
          fontSize: 13,
        }}
      >
        {JSON.stringify(body, null, 2)}
      </pre>
      <p>
        <a href="/">Home</a>
      </p>
    </main>
  );
}
