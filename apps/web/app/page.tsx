async function fetchHealth() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const res = await fetch(`${base}/health`, { cache: "no-store" });
  if (!res.ok) {
    return { ok: false as const, status: res.status, text: await res.text() };
  }
  return { ok: true as const, json: (await res.json()) as Record<string, unknown> };
}

export default async function Home() {
  const health = await fetchHealth();

  return (
    <main>
      <h1>beacon-oncall</h1>
      <p>Web is up. API health:</p>
      <pre
        style={{
          background: "#111",
          color: "#e6e6e6",
          padding: 16,
          borderRadius: 8,
          overflow: "auto",
        }}
      >
        {JSON.stringify(health, null, 2)}
      </pre>
      <p style={{ color: "#666", fontSize: 14 }}>
        Set <code>NEXT_PUBLIC_API_URL</code> if the API is not on <code>http://localhost:3001</code>.
      </p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <a href="/public/demo/status">Public status (org slug: demo)</a>
        </li>
        <li>
          <a href="/orgs/demo/incidents">Operator incidents list (session cookie)</a>
        </li>
      </ul>
    </main>
  );
}
