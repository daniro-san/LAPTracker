// Upstream images served from our own origin (DECISIONS D22), so the page CSP keeps img-src 'self'.
// Never an open proxy: the upstream URL is built from a preset id or read from our own table,
// and only these two hosts are fetched.
import { photoUrl, USER_AGENT } from "./sources/shared";

const BADGE_IDS = { min: 101, max: 110 };

const TIMEOUT_MS = 5_000;
/** Badges are ~33 KB; well under Vercel's 4.5 MB response limit. */
const MAX_BYTES = 1024 * 1024;
/** Raster only: an SVG served from our origin could carry script. */
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

export const BADGE_CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";
export const AVATAR_CACHE = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

/**
 * The badge file for a preset id, on the tracker site's origin (LAP_SITE_BASE_URL); null outside
 * 101–110. Confirmed 2026-11-04 with one plain GET: 300×300 PNGs, about 33 KB.
 */
export function badgeSource(id: number, siteBaseUrl: string): string | null {
  if (!Number.isInteger(id) || id < BADGE_IDS.min || id > BADGE_IDS.max) return null;
  return `${new URL(siteBaseUrl).origin}/static/alliance/badge_${id}.png`;
}

/** The stored photo URL, re-checked at serve time (rows may predate the adapter check). */
export const avatarSource = (stored: string | null): string | null => photoUrl(stored);

/** 404 with no body: every failure looks the same from outside. */
export const notFoundImage = (): Response =>
  new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });

type Image = { body: Uint8Array<ArrayBuffer>; type: string };
/** Why a fetch failed: the HTTP status, or the error's class name. Never the URL or a message. */
export type ImageFailure = { http_status: number } | { error: string };

/** One warn line for a failed upstream fetch (issue 126); a missing photo or bad id is not one. */
export const logImageFailure = (route: string, id: string, failure: ImageFailure) =>
  console.warn("image.fetch_failed", { route, id, ...failure });

/** Fetch an image with a timeout, no redirects, a size cap and a raster type; the reason on any failure. */
export async function fetchImage(
  url: string,
  doFetch: typeof fetch,
): Promise<Image | ImageFailure> {
  try {
    const response = await doFetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!response.ok || !acceptable(response, type)) {
      await response.body?.cancel();
      return response.ok ? UNUSABLE : { http_status: response.status };
    }
    const body = await readCapped(response.body as ReadableStream<Uint8Array>);
    return body ? { body, type } : UNUSABLE;
  } catch (error) {
    return { error: className(error) };
  }
}

const acceptable = (response: Response, type: string) =>
  TYPES.has(type) &&
  Number(response.headers.get("content-length") ?? 0) <= MAX_BYTES &&
  !!response.body;
const UNUSABLE: ImageFailure = { error: "UnusableImage" };
const className = (error: unknown) =>
  error instanceof Error ? error.constructor.name : typeof error;

/** The whole stream, or null once it passes MAX_BYTES (a missing or false content-length). */
async function readCapped(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > MAX_BYTES) return null;
    chunks.push(chunk);
  }
  const body = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    body.set(c, at);
    at += c.byteLength;
  }
  return body;
}

export const imageResponse = (
  image: { body: Uint8Array<ArrayBuffer>; type: string },
  cache: string,
) => new Response(image.body, { headers: { "Content-Type": image.type, "Cache-Control": cache } });
