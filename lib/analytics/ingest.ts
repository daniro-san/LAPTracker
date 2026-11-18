// PostHog's same-origin reverse proxy (D77): /ingest/<path> goes to PostHog's US cloud, so the page's CSP keeps
// `connect-src 'self'`. A route handler, not a next.config rewrite: a rewrite forwards every request header, so
// the browser's cookies (the workspace and /admin sessions among them) would reach PostHog. Only the body, its
// type and encoding, PostHog's own query string and our origin are sent, and on the events paths the visitor's
// IP as `x-forwarded-for` (D115): PostHog's cookieless mode needs it for the daily hash that counts unique
// visitors, then drops it; the project discards IPs (D77). Replay batches and the remote config carry no IP.
// Only the paths the SDK uses are forwarded, and a body over MAX_BODY_BYTES is refused.
import { clientIp } from "../auth";
import { POSTHOG_ASSETS_HOST, POSTHOG_INGEST_HOST } from "./region";

const PREFIX = "/ingest";
const FORWARDED = ["content-type", "content-encoding"];
const TIMEOUT_MS = 10_000;
/** A replay batch is flushed at about 0.9 MB before compression (posthog-js); the local check's largest was far below. */
export const MAX_BODY_BYTES = 1024 * 1024;
/** Remote config, when PostHog's answer names no cache time: five minutes at Vercel's edge. */
const ASSET_CACHE = "public, s-maxage=300";

/** What the posthog-js no-external build requests (D77): events, replay batches and the remote config. */
const ROUTES: { method: string; path: RegExp; host: string; ip?: true }[] = [
  { method: "POST", path: /^\/(?:e|i\/v0\/e)\/$/, host: POSTHOG_INGEST_HOST, ip: true },
  { method: "POST", path: /^\/s\/$/, host: POSTHOG_INGEST_HOST },
  { method: "GET", path: /^\/array\/[\w-]+\/config$/, host: POSTHOG_ASSETS_HOST },
];

const status = (code: number) =>
  new Response(null, { status: code, headers: { "cache-control": "no-store" } });

/** The body's type and encoding, and our origin: it lets PostHog check the project's authorized domains for replay. */
function upstreamHeaders(request: Request, origin: string, ip: boolean): Headers {
  const headers = new Headers({ origin });
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const visitor = clientIp(request.headers);
  if (ip && visitor !== "unknown") headers.set("x-forwarded-for", visitor);
  return headers;
}

/** PostHog's answer and its type; the remote config (GET) keeps PostHog's cache time, ingestion is never cached. */
function relay(answer: Response, method: string): Response {
  const cache =
    method === "GET" ? (answer.headers.get("cache-control") ?? ASSET_CACHE) : "no-store";
  return new Response(answer.status === 204 ? null : answer.body, {
    status: answer.status,
    headers: {
      "content-type": answer.headers.get("content-type") ?? "text/plain",
      "cache-control": cache,
    },
  });
}

export async function forwardToPostHog(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(PREFIX.length);
  const route = ROUTES.find((r) => r.method === request.method && r.path.test(path));
  if (!route) return status(404);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return status(413);
  const body = request.method === "POST" ? await request.arrayBuffer() : undefined;
  if (body && body.byteLength > MAX_BODY_BYTES) return status(413);
  try {
    const answer = await fetch(`${route.host}${path}${url.search}`, {
      method: request.method,
      headers: upstreamHeaders(request, url.origin, route.ip === true),
      ...(body && { body }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return relay(answer, request.method);
  } catch {
    return status(502);
  }
}
