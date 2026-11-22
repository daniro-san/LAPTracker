// What every workspace response and write shares (D71): no caching anywhere, and writes only from our own
// pages. A write needs Origin equal to the app's origin, Sec-Fetch-Site same-origin when the browser sends
// it, and a JSON body, which a cross-site form cannot send without a CORS preflight.
export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

// The JSON rule's one copy, shared with the public routes (issue 509).
export { isSameOriginJson } from "../same-origin";

/**
 * A picture sent from our own page as the request's whole body (issue 299). A cross-site form cannot
 * send an image content type without a CORS preflight, so the same rule as JSON holds.
 */
export function isSameOriginPicture(request: Request): boolean {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const type = request.headers.get("content-type") ?? "";
  return (
    origin === new URL(request.url).origin &&
    (site === null || site === "same-origin") &&
    /^image\/(png|jpeg|webp)$/.test(type.split(";")[0]?.trim() ?? "")
  );
}

/**
 * The phone's share target (D110): Android posts the shared pictures as a form, in a navigation the browser
 * makes itself, so Sec-Fetch-Site is "none" and Origin is absent or "null". A cross-site form is
 * "cross-site" (and carries no SameSite=Lax session cookie either). A post from our own page passes too.
 */
export function isShareTarget(request: Request): boolean {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const type = request.headers.get("content-type") ?? "";
  const own = new URL(request.url).origin;
  const byBrowser = site === "none" && (origin === null || origin === "null" || origin === own);
  const byUs = origin === own && (site === null || site === "same-origin");
  return (byBrowser || byUs) && type.split(";")[0]?.trim() === "multipart/form-data";
}

/** A JSON error code, never a message or a stack (D71). */
export const privateError = (status: number, code: string): Response =>
  Response.json({ code }, { status, headers: NO_STORE });

/**
 * Runs work that carries what officers typed or a sheet held (member facts, D80). A database error's
 * message quotes the query's parameters, and app_errors keeps a message: so an error
 * leaves here as `code` alone, without its message or cause (D71).
 */
export async function privately<T>(
  code: string | ((error: unknown) => string),
  work: () => Promise<T>,
): Promise<T> {
  // No `cause` on purpose: the cause is what must not leave (D71). `code` may name the error's kind.
  return Promise.resolve()
    .then(work)
    .catch((error: unknown) => {
      throw new Error(typeof code === "string" ? code : code(error));
    });
}

/** A 303 to `location` that sets each cookie on the way. */
export function redirectWith(location: string, cookies: readonly string[]): Response {
  const headers = new Headers({ ...NO_STORE, Location: location });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

/** The request's cookies by name, as `requireWorkspace` reads them. */
export function requestCookies(request: Request): {
  get(name: string): { value: string } | undefined;
} {
  const jar = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0) jar.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }
  return {
    get: (name) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { value };
    },
  };
}
