/**
 * api-utils.ts — shared fetch helpers
 * Prevents "Unexpected token '<'" JSON parse errors when Next.js returns HTML error pages.
 */

/**
 * Safe JSON fetch: throws a readable Error if response is not ok or not JSON.
 * Use this instead of bare `await res.json()` for all API calls.
 */
export async function safeJson<T>(res: Response, context: string): Promise<T> {
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok || !ct.includes("application/json")) {
    const text = await res.text().catch(() => "[unreadable]");
    throw new Error(`${context}: ${res.status} — ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
