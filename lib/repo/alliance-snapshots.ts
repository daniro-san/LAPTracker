// alliance_snapshots and their member_snapshots, which are only ever written together.
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import type { Db } from "../db";
import { allianceSnapshots, memberSnapshots, playerFrames } from "../schema";
import type { AllianceRow, AllianceRowStatus, MemberRow } from "./index";
import { recordFrames } from "./player-frames";

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
    await recordFrames(tx, members, row.sourceUpdatedAt);
  });
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
/** A map square for the int[] columns; anything else is null, so an odd value never fails the row. */
const square = (v: unknown) => (Number.isSafeInteger(v) ? (v as number) : null);

/** Each member's map place from the read's raw members (D163), by uid. */
function placesOf(raw: unknown): Map<number, { x: number | null; y: number | null }> {
  const list = (raw as { members?: unknown } | null)?.members;
  if (!Array.isArray(list)) return new Map();
  return new Map(
    list.flatMap((m: { uid?: unknown; x?: unknown; y?: unknown }) => {
      const uid = num(m?.uid);
      return uid === null ? [] : [[uid, { x: square(m.x), y: square(m.y) }] as const];
    }),
  );
}

/** A sample's row (D69): the members as D60's parallel arrays (a null power or kills stays null, D15), with
 * their map places (D163), no member_snapshots rows and no raw_json. An error row has no arrays. */
export async function insertSampleRow(
  db: Db,
  snapshotId: number,
  row: AllianceRow,
  members: MemberRow[],
): Promise<void> {
  const at = placesOf(row.raw);
  const arrays = row.error === null && {
    memberUids: members.map((m) => m.uid),
    memberNames: members.map((m) => m.name),
    // Drizzle types the elements as numbers; a null stays null in the array.
    memberPower: members.map((m) => m.power) as number[],
    memberKills: members.map((m) => m.kills) as number[],
    memberX: members.map((m) => at.get(m.uid)?.x ?? null) as number[],
    memberY: members.map((m) => at.get(m.uid)?.y ?? null) as number[],
  };
  // `row.raw` names no column, so the insert drops it; raw_json stays null.
  await db.insert(allianceSnapshots).values({ ...row, snapshotId, rawJson: null, ...arrays });
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

/** The player's photo URL from their newest roster row and their current frame; nulls when there is none.
 * The URL is never served (D22, D65). */
export async function findPhoto(
  db: Db,
  uid: number,
): Promise<{ avatarUrl: string | null; frameId: number | null }> {
  const [row] = await db
    .select({ avatarUrl: memberSnapshots.avatarUrl, frameId: playerFrames.frameId })
    .from(memberSnapshots)
    .leftJoin(playerFrames, eq(playerFrames.uid, memberSnapshots.uid))
    .where(eq(memberSnapshots.uid, uid))
    .orderBy(desc(memberSnapshots.id))
    .limit(1);
  return row ?? { avatarUrl: null, frameId: null };
}

/** A re-run without force (D62): the rows whose read failed go, so the run reads those alliances again;
 * with `stale` (D63) the stale rows go too (an error row is never fresh). The rest stay. Error rows have
 * no members; the delete covers them anyway. */
export async function clearFailedAllianceRows(
  db: Db,
  snapshotId: number,
  stale: boolean,
): Promise<void> {
  const failed = and(
    eq(allianceSnapshots.snapshotId, snapshotId),
    stale ? eq(allianceSnapshots.isFresh, false) : isNotNull(allianceSnapshots.error),
  );
  await db.transaction(async (tx) => {
    const ids = tx.select({ id: allianceSnapshots.id }).from(allianceSnapshots).where(failed);
    await tx.delete(memberSnapshots).where(inArray(memberSnapshots.allianceSnapshotId, ids));
    await tx.delete(allianceSnapshots).where(failed);
  });
}
