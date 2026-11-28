// An alliance's glossary row (#832): the whole list of words its translate, improve and fit requests keep as
// written. Plain reads and writes; the rules are in lib/private/glossary.ts.
import { eq } from "drizzle-orm";

import type { Db } from "../db";
import { workspaceGlossary } from "../schema-features";

/** The workspace's words, in the order saved; none when it never saved a list. */
export async function glossaryOf(db: Db, workspaceId: number): Promise<string[]> {
  const [row] = await db
    .select({ words: workspaceGlossary.words })
    .from(workspaceGlossary)
    .where(eq(workspaceGlossary.workspaceId, workspaceId));
  return row?.words ?? [];
}

export async function saveGlossary(
  db: Db,
  row: { workspaceId: number; words: string[]; updatedBy: number; updatedAt: Date },
): Promise<void> {
  await db
    .insert(workspaceGlossary)
    .values(row)
    .onConflictDoUpdate({
      target: workspaceGlossary.workspaceId,
      set: { words: row.words, updatedBy: row.updatedBy, updatedAt: row.updatedAt },
    });
}
