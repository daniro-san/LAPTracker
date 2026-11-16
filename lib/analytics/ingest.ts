// PostHog's same-origin reverse proxy (D77): /ingest/<path> goes to PostHog's US cloud, /static/ and /array/ to
// the assets host and everything else to the ingestion host, so the page's CSP keeps `connect-src 'self'`.
// A route handler, not a next.config rewrite: a rewrite forwards every request header, so the browser's cookies
// (the workspace and /admin sessions among them) and its IP would reach PostHog. Only the body, its type and
// encoding, PostHog's own query string and our origin are sent; PostHog sees Vercel's address, not the visitor's.
import { POSTHOG_ASSETS_HOST, POSTHOG_INGEST_HOST } from "./region";

const PREFIX = "/ingest";
const FORWARDED = ["content-type", "content-encoding"];
const TIMEOUT_MS = 10_000;

export function postHogUrl(url: URL): string {
  const path = url.pathname.slice(PREFIX.length);
  const host = /^\/(?:static|array)\//.test(path) ? POSTHOG_ASSETS_HOST : POSTHOG_INGEST_HOST;
  return `${host}${path}${url.search}`;
}

export async function forwardToPostHog(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // The origin lets PostHog check the project's authorized domains for replay; it names the site, not the visitor.
  const headers = new Headers({ origin: url.origin });
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const answer = await fetch(postHogUrl(url), {
      method: request.method,
      headers,
      ...(request.method === "POST" && { body: await request.arrayBuffer() }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return new Response(answer.status === 204 ? null : answer.body, {
      status: answer.status,
      headers: {
        "content-type": answer.headers.get("content-type") ?? "text/plain",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response(null, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
