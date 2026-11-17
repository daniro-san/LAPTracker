// start_here (D105): the members' board's one record per workspace. A plain read, and one save under a lock
// on the workspace's row; what a save may write and its version check stay in lib/private.
import { eq } from "drizzle-orm";

import type { Db } from "../db";
import { startHere } from "../schema-board";

export type StartHereRow = typeof startHere.$inferSelect;

export async function readStartHere(db: Db, workspaceId: number): Promise<StartHereRow | null> {
  const [row] = await db.select().from(startHere).where(eq(startHere.workspaceId, workspaceId));
  return row ?? null;
}

/**
 * One save. The row is made empty when there is none, then locked, so two officers saving at once are taken
 * one after the other. `decide` sees the row as it stands and returns what to write, or a refusal.
 */
export async function writeStartHere<R>(
  db: Db,
  workspaceId: number,
  by: { userId: number; now: Date },
  decide: (
    row: StartHereRow,
  ) => { write: Pick<StartHereRow, "texts" | "edits" | "rev"> } | { refuse: R },
): Promise<{ ok: true; version: number } | { refuse: R }> {
  return db.transaction(async (tx) => {
    await tx.insert(startHere).values({ workspaceId }).onConflictDoNothing();
    const [row] = await tx
      .select()
      .from(startHere)
      .where(eq(startHere.workspaceId, workspaceId))
      .for("update");
    if (!row) throw new Error("start_here_row_missing");
    const decision = decide(row);
    if ("refuse" in decision) return decision;
    await tx
      .update(startHere)
      .set({ ...decision.write, updatedBy: by.userId, updatedAt: by.now })
      .where(eq(startHere.workspaceId, workspaceId));
    return { ok: true as const, version: decision.write.rev };
  });
}
