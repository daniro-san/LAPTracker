// alliance_snapshots and their member_snapshots, which are only ever written together.
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

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

/** The player's photo URL from their newest roster row; null when that row has none. Never served (D22). */
export async function findAvatarUrl(db: Db, uid: number): Promise<string | null> {
  const [row] = await db
    .select({ avatarUrl: memberSnapshots.avatarUrl })
    .from(memberSnapshots)
    .where(eq(memberSnapshots.uid, uid))
    .orderBy(desc(memberSnapshots.id))
    .limit(1);
  return row?.avatarUrl ?? null;
}

/** A re-run without force (D62): the rows whose read failed go, so the run reads those alliances again;
 * the rows that were read stay. Error rows have no members; the delete covers them anyway. */
export async function clearFailedAllianceRows(db: Db, snapshotId: number): Promise<void> {
  const failed = and(
    eq(allianceSnapshots.snapshotId, snapshotId),
    isNotNull(allianceSnapshots.error),
  );
  await db.transaction(async (tx) => {
    const ids = tx.select({ id: allianceSnapshots.id }).from(allianceSnapshots).where(failed);
    await tx.delete(memberSnapshots).where(inArray(memberSnapshots.allianceSnapshotId, ids));
    await tx.delete(allianceSnapshots).where(failed);
  });
}
