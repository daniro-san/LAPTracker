// hero_catalog (D117): the tracker's hero ids and names. Refreshed by the squads read at most once a day;
// read by the member card (names) and /img/hero/[id] (only catalog ids are fetched).
import { eq, max, sql } from "drizzle-orm";

import type { Db } from "../db";
import { heroCatalog } from "../schema-squads";

export async function heroNames(db: Db): Promise<Map<number, string>> {
  const rows = await db.select({ id: heroCatalog.id, name: heroCatalog.name }).from(heroCatalog);
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function isCatalogHero(db: Db, id: number): Promise<boolean> {
  const [row] = await db
    .select({ id: heroCatalog.id })
    .from(heroCatalog)
    .where(eq(heroCatalog.id, id));
  return row !== undefined;
}

/** When the catalog was last refreshed; null when it is empty. */
export async function catalogUpdatedAt(db: Db): Promise<Date | null> {
  const [row] = await db.select({ at: max(heroCatalog.updatedAt) }).from(heroCatalog);
  return row?.at ?? null;
}

/** Adds or renames heroes; a hero the new catalog no longer lists is kept, so old squads keep a name. */
export async function saveHeroCatalog(
  db: Db,
  heroes: readonly { id: number; name: string }[],
  now: Date,
): Promise<void> {
  if (heroes.length === 0) return;
  await db
    .insert(heroCatalog)
    .values(heroes.map((h) => ({ ...h, updatedAt: now })))
    .onConflictDoUpdate({
      target: heroCatalog.id,
      set: { name: sql`excluded.name`, updatedAt: sql`excluded.updated_at` },
    });
}
