// alliance_snapshots and their member_snapshots, which are only ever written together.
import { eq, inArray } from "drizzle-orm";

import type { Db } from "../db";
import { allianceSnapshots, memberSnapshots } from "../schema";
import type { AllianceRow, AllianceRowStatus, MemberRow } from "./index";

export async function listAllianceRows(db: Db, snapshotId: number): Promise<AllianceRowStatus[]> {
  return db
    .select({
      unionId: allianceSnapshots.unionId,
      tag: allianceSnapshots.tag,
      isFresh: allianceSnapshots.isFresh,
      error: allianceSnapshots.error,
    })
    .from(allianceSnapshots)
    .where(eq(allianceSnapshots.snapshotId, snapshotId));
}

export async function insertAllianceRow(
  db: Db,
  snapshotId: number,
  row: AllianceRow,
  members: MemberRow[],
): Promise<void> {
  const { raw, ...fields } = row;
  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(allianceSnapshots)
      .values({ ...fields, snapshotId, rawJson: raw ?? null })
      .returning({ id: allianceSnapshots.id });
    if (!inserted || members.length === 0) return;
    await tx
      .insert(memberSnapshots)
      .values(members.map((m) => ({ ...m, allianceSnapshotId: inserted.id })));
  });
}

/** Used only by a forced re-run, which collects the whole snapshot again. */
export async function clearAllianceRows(db: Db, snapshotId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const ids = tx
      .select({ id: allianceSnapshots.id })
      .from(allianceSnapshots)
      .where(eq(allianceSnapshots.snapshotId, snapshotId));
    await tx.delete(memberSnapshots).where(inArray(memberSnapshots.allianceSnapshotId, ids));
    await tx.delete(allianceSnapshots).where(eq(allianceSnapshots.snapshotId, snapshotId));
  });
}
