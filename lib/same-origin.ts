// The same-origin rule for writes from our own pages: one copy for the public routes and the workspace's
// (lib/private/http.ts re-exports it, D71). It imports nothing, so lib/private reaches no lib/notify* here.

/**
 * Origin equal to the app's, Sec-Fetch-Site same-origin when the browser sends it, and a JSON body, which a
 * cross-site form cannot send without a CORS preflight.
 */
export function isSameOriginJson(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  const type = request.headers.get("content-type") ?? "";
  return (
    request.headers.get("origin") === new URL(request.url).origin &&
    (site === null || site === "same-origin") &&
    type.split(";")[0]?.trim() === "application/json"
  );
}
