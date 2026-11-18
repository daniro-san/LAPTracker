// The tracker's hero catalog and pictures (D117): public static files on the tracker site's origin
// (LAP_SITE_BASE_URL), no API and no quota. The catalog maps a hero id to its name and is read by the
// squads read at most once a day; pictures reach pages only through /img/hero/[id] (D22's rule), and
// only for ids in the stored catalog.
import { z } from "zod";

import type { Db } from "./db";
import type { Logger } from "./logger";
import { catalogUpdatedAt, saveHeroCatalog } from "./repo/hero-catalog";
import { USER_AGENT } from "./sources/shared";

/** A hero id names one picture; pictures change rarely, so a month in every cache. */
export const HERO_CACHE =
  "public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800";

/** The catalog is read again when it is older than this (at most daily: the squads read runs once a day). */
export const CATALOG_MAX_AGE_MS = 20 * 60 * 60_000;

const TIMEOUT_MS = 5_000;
const ID = /^\d{1,9}$/;

/** `"10005": {"icon": "/static/heroes/10005.png", "name": "Kesso"}`; only the name is kept. */
const catalogSchema = z.record(
  z.string().regex(ID),
  z.object({ name: z.string().trim().min(1).max(80) }),
);

const origin = (siteBaseUrl: string) => new URL(siteBaseUrl).origin;

/** A hero's picture on the tracker site, built from the id alone (never from the catalog's `icon`). */
export function heroSource(id: number, siteBaseUrl: string): string | null {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return `${origin(siteBaseUrl)}/static/heroes/${id}.png`;
}

/** The catalog as id and name, or the failure as a class name or HTTP status (never the URL). */
export async function fetchHeroCatalog(
  siteBaseUrl: string,
  doFetch: typeof fetch,
): Promise<{ heroes: { id: number; name: string }[] } | { failure: string }> {
  try {
    const response = await doFetch(`${origin(siteBaseUrl)}/static/heroes.json`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { failure: `http ${response.status}` };
    }
    const parsed = catalogSchema.safeParse(await response.json());
    if (!parsed.success) return { failure: "schema" };
    const heroes = Object.entries(parsed.data).map(([id, h]) => ({ id: Number(id), name: h.name }));
    return { heroes };
  } catch (e) {
    return { failure: e instanceof Error ? e.name : "error" };
  }
}

/**
 * The squads read's first batch of the day (D117): the catalog again when it is empty or older than
 * CATALOG_MAX_AGE_MS. A failure keeps the old one. One `squads.heroes` line: the count or the failure.
 */
export async function refreshHeroCatalog(
  db: Db,
  siteBaseUrl: string,
  doFetch: typeof fetch,
  now: Date,
  log: Logger,
): Promise<void> {
  const at = await catalogUpdatedAt(db);
  if (at && now.getTime() - at.getTime() < CATALOG_MAX_AGE_MS) return;
  const result = await fetchHeroCatalog(siteBaseUrl, doFetch);
  if ("failure" in result) {
    await log.warn("squads.heroes", { failure: result.failure });
    return;
  }
  await saveHeroCatalog(db, result.heroes, now);
  await log.info("squads.heroes", { heroes: result.heroes.length });
}
