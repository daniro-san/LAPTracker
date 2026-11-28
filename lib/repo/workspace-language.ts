// A workspace's default desk language (issue 438): plain read and write; what it means is in
// lib/private/desk-language.ts.
import { eq } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces } from "../schema";

const w = workspaces;

/** The saved language of the workspace with this slug; null when none is saved or no workspace has the slug. */
export async function defaultLanguageOf(db: Db, slug: string): Promise<string | null> {
  const [row] = await db.select({ language: w.defaultLanguage }).from(w).where(eq(w.slug, slug));
  return row?.language ?? null;
}

export async function saveDefaultLanguage(
  db: Db,
  workspaceId: number,
  language: string | null,
): Promise<void> {
  await db.update(w).set({ defaultLanguage: language }).where(eq(w.id, workspaceId));
}
