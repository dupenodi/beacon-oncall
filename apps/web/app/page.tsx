import Link from "next/link";

/**
 * Fallback when middleware is skipped. Middleware normally redirects `/` → `/login`.
 */
export default function HomePage() {
  return (
    <main className="login-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="login-card" style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <p className="text-secondary" style={{ marginBottom: 16 }}>
          Beacon — incident management
        </p>
        <Link href="/login" className="btn btn-primary" style={{ display: "inline-flex", justifyContent: "center" }}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
