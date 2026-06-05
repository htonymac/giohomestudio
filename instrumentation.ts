// Next.js instrumentation hook — runs once at server start.
// Boots Sentry for both node and edge runtimes.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Catch errors thrown in nested React Server Components / Route Handlers.
export async function onRequestError(error: unknown, request: { path: string; method: string; headers: Headers }) {
  const { captureException } = await import("@sentry/nextjs");
  captureException(error, { data: { path: request.path, method: request.method } });
}
