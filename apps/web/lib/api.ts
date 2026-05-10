export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...((options?.headers as Record<string, string>) ?? {}),
      },
    });
    if (res.status === 204) return { data: null, error: null, status: 204 };
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { msg = JSON.parse(text)?.error ?? text; } catch { /* ignore */ }
      return { data: null, error: msg || `HTTP ${res.status}`, status: res.status };
    }
    try {
      return { data: JSON.parse(text) as T, error: null, status: res.status };
    } catch {
      return { data: null, error: "Invalid JSON response", status: res.status };
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Network error", status: 0 };
  }
}

export function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
