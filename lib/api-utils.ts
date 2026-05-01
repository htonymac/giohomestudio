/**
 * lib/api-utils.ts — shared fetch helpers for GHS client pages
 *
 * IMPORT WITH RELATIVE PATH — never "@/lib/api-utils"
 * e.g. import { safeJson } from '../../../lib/api-utils';
 */

/**
 * safeJson — wraps a fetch Response and throws a descriptive error if the
 * server returned an HTML error page (Next.js 500/400/etc) instead of JSON.
 *
 * Usage:
 *   const res = await fetch('/api/some-route', { ... });
 *   const data = await safeJson<MyType>(res, 'context-label');
 */
export async function safeJson<T>(res: Response, context = "API call"): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("json")) {
    const text = await res.text().catch(() => "(unreadable body)");
    throw new Error(
      `[${context}] API error ${res.status}: ${text.slice(0, 300)}`
    );
  }
  return res.json() as Promise<T>;
}
