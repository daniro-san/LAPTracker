// An event's movers (#70): the biggest gains and losses in might and kills, for alliances and for
// members, ranked by compute.topMovers. Member fields served: uid, name, power, kills and the alliance
// they are in (§12.1); raw_json and avatar_url are never selected.
import { eq, inArray } from "drizzle-orm";

import {
  topMovers,
  topRankMovers,
  type Measured,
  type Mover,
  type MoverInput,
  type RankMoverInput,
} from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, memberSnapshots } from "../schema";
import type { Ranks } from "./ranks";

/** Alliances per list, as in the Discord message; members per list (owner, 2026-11-05). */
export const ALLIANCE_MOVERS = 3;
export const MEMBER_MOVERS = 5;

export interface MoverLists<R> {
  mightGains: Mover<R>[];
  mightLosses: Mover<R>[];
  killsGains: Mover<R>[];
}

export function moverLists<R extends MoverInput>(rows: readonly R[], n: number): MoverLists<R> {
  return {
    mightGains: topMovers(rows, "power", n, "gain"),
    mightLosses: topMovers(rows, "power", n, "loss"),
    killsGains: topMovers(rows, "kills", n, "gain"),
  };
}

interface AllianceSide {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  totalPower: number | null;
  totalKills: number | null;
  isFresh: boolean;
  failed: boolean;
}

export interface AllianceMover extends RankMoverInput {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
}

/** A stale or failed side counts as unusable, as in the Discord movers. */
const measured = (a: AllianceSide): Measured => ({
  isFresh: a.isFresh && !a.failed,
  totalPower: a.totalPower,
  totalKills: a.totalKills,
});

/** The ledger rank by might on each side; null where the snapshot did not rank the alliance. */
const ledgerOf = (r: Partial<Record<"before" | "after", Ranks>> | undefined) => ({
  before: r?.before?.might ?? null,
  after: r?.after?.might ?? null,
});

export interface AllianceMoverLists extends MoverLists<AllianceMover> {
  /** The biggest climbs and falls by ledger rank by might (D23), top 3 each. */
  rankUp: { row: AllianceMover; move: number }[];
  rankDown: { row: AllianceMover; move: number }[];
}

/**
 * Alliance movers from the event detail's two snapshot rows and the event's ledger ranks
 * (`eventRanks`); an alliance seen on one side only is out.
 */
export function allianceMovers(
  before: readonly AllianceSide[],
  after: readonly AllianceSide[],
  ranks: Map<number, Partial<Record<"before" | "after", Ranks>>>,
): AllianceMoverLists {
  const was = new Map(before.map((a) => [a.unionId, a]));
  const rows = after.map((a) => {
    const b = was.get(a.unionId);
    return {
      unionId: a.unionId,
      tag: a.tag ?? b?.tag ?? null,
      name: a.name ?? b?.name ?? null,
      badgeId: a.badgeId ?? b?.badgeId ?? null,
      before: b ? measured(b) : null,
      after: measured(a),
      ledger: ledgerOf(ranks.get(a.unionId)),
    };
  });
  return {
    ...moverLists(rows, ALLIANCE_MOVERS),
    rankUp: topRankMovers(rows, ALLIANCE_MOVERS, "gain"),
    rankDown: topRankMovers(rows, ALLIANCE_MOVERS, "loss"),
  };
}

export interface MemberMover extends MoverInput {
  uid: number;
  name: string;
  /** The alliance the member is in after the event: a switcher counts there (owner, 2026-11-05). */
  unionId: number;
  tag: string | null;
}

/**
 * Member movers between an event's two snapshots, keyed by uid across every tracked alliance; null
 * until both have run. A member read on one side only is not ranked. `unionId` narrows the lists to
 * one alliance's after roster.
 */
export async function memberMovers(
  db: Db,
  snapshots: readonly { id: number; phase: "before" | "after" }[],
  unionId?: number,
): Promise<MoverLists<MemberMover> | null> {
  const [b, a] = (["before", "after"] as const).map((ph) => snapshots.find((s) => s.phase === ph));
  if (!b || !a) return null;
  const snapshotIds = { before: b.id, after: a.id };
  const rows = await db
    .select({
      snapshotId: allianceSnapshots.snapshotId,
      unionId: allianceSnapshots.unionId,
      tag: allianceSnapshots.tag,
      isFresh: allianceSnapshots.isFresh,
      error: allianceSnapshots.error,
      uid: memberSnapshots.uid,
      name: memberSnapshots.name,
      power: memberSnapshots.power,
      kills: memberSnapshots.kills,
    })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .where(inArray(allianceSnapshots.snapshotId, [snapshotIds.before, snapshotIds.after]));
  const side = (r: (typeof rows)[number]): Measured => ({
    isFresh: r.isFresh && r.error === null,
    totalPower: r.power,
    totalKills: r.kills,
  });
  const before = new Map(
    rows.filter((r) => r.snapshotId === snapshotIds.before).map((r) => [r.uid, r]),
  );
  const members = rows
    .filter((r) => r.snapshotId === snapshotIds.after)
    .filter((r) => unionId === undefined || r.unionId === unionId)
    .sort((x, y) => x.uid - y.uid)
    .map((a) => {
      const b = before.get(a.uid);
      return {
        uid: a.uid,
        name: a.name,
        unionId: a.unionId,
        tag: a.tag,
        before: b ? side(b) : null,
        after: side(a),
      };
    });
  return moverLists(members, MEMBER_MOVERS);
}
