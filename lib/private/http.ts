// What every workspace response and write shares (D71): no caching anywhere, and writes only from our own
// pages. A write needs Origin equal to the app's origin, Sec-Fetch-Site same-origin when the browser sends
// it, and a JSON body, which a cross-site form cannot send without a CORS preflight.
export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function isSameOriginJson(request: Request): boolean {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const type = request.headers.get("content-type") ?? "";
  return (
    origin === new URL(request.url).origin &&
    (site === null || site === "same-origin") &&
    type.split(";")[0]?.trim() === "application/json"
  );
}

/** A JSON error code, never a message or a stack (D71). */
export const privateError = (status: number, code: string): Response =>
  Response.json({ code }, { status, headers: NO_STORE });

/**
 * Runs work that carries what officers typed or a sheet held (member facts, D80). A database error's
 * message quotes the query's parameters, and app_errors and the admin alert keep a message: so an error
 * leaves here as `code` alone, without its message or cause (D71).
 */
export async function privately<T>(code: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch {
    throw new Error(code);
  }
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
