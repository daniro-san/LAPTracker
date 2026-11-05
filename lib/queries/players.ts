// Read models for the player pages (plan Phase 5d, 5e). Served member fields: uid, name, power,
// kills, lv only, plus the alliance tag and event dates (§12.1); raw_json is never selected.
import { and, asc, desc, eq, ilike, inArray, max, sql } from "drizzle-orm";

import {
  nameHistory,
  seriesDeltas,
  type NameHistoryEntry,
  type NameSighting,
  type SeriesStep,
} from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";

export const SEARCH_LIMIT = 50;

type Phase = "before" | "after";

interface Sighting {
  eventId: number;
  eventName: string;
  eventAtUtc: Date;
  phase: Phase;
  unionId: number;
  tag: string | null;
  allianceName: string | null;
  isFresh: boolean;
  sourceUpdatedAt: Date | null;
  name: string;
  power: number | null;
  kills: number | null;
  lv: number | null;
}

export interface PlayerFresh {
  isFresh: boolean;
  updatedAt: Date | null;
}

export interface PlayerEventRow {
  eventId: number;
  eventName: string;
  eventAtUtc: Date;
  /** `before` marks the fallback: the player is missing from the after roster (Phase 5e). */
  reference: Phase;
  name: string;
  unionId: number;
  tag: string | null;
  allianceName: string | null;
  power: number | null;
  kills: number | null;
  lv: number | null;
  /** The before-snapshot values and the in-event change; null unless both snapshots hold fresh data. */
  inEvent: {
    fromPower: number | null;
    fromKills: number | null;
    fromLv: number | null;
    power: number | null;
    kills: number | null;
    lv: number | null;
  } | null;
  /** Change vs the previous event's reference value, never before-of-one vs after-of-another. */
  step: SeriesStep;
  previous: { name: string; tag: string | null; unionId: number } | null;
  before: PlayerFresh | null;
  after: PlayerFresh | null;
}

export interface AllianceStay {
  unionId: number;
  tag: string | null;
  name: string | null;
  firstSeen: Date;
  lastSeen: Date;
  /** The event of the last sighting, for the link to that alliance's page. */
  lastEventId: number;
}

export interface PlayerHistory {
  uid: number;
  current: { name: string; unionId: number; tag: string | null; eventId: number };
  /** Oldest first. */
  rows: PlayerEventRow[];
  names: NameHistoryEntry[];
  alliances: AllianceStay[];
}

const sightingColumns = {
  eventId: events.id,
  eventName: events.name,
  eventAtUtc: events.eventAtUtc,
  phase: snapshots.phase,
  unionId: allianceSnapshots.unionId,
  tag: allianceSnapshots.tag,
  allianceName: allianceSnapshots.name,
  isFresh: allianceSnapshots.isFresh,
  sourceUpdatedAt: allianceSnapshots.sourceUpdatedAt,
  name: memberSnapshots.name,
  power: memberSnapshots.power,
  kills: memberSnapshots.kills,
  lv: memberSnapshots.lv,
};

/** Every roster row of these uids in a real event, oldest first; test events are never part of it. */
function sightingsOf(db: Db, uids: number[]): Promise<(Sighting & { uid: number })[]> {
  return db
    .select({ uid: memberSnapshots.uid, ...sightingColumns })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(and(inArray(memberSnapshots.uid, uids), eq(events.isTest, false)))
    .orderBy(asc(events.eventAtUtc), sql`${snapshots.phase} desc`);
}

const freshOf = (s: Sighting | undefined): PlayerFresh | null =>
  s ? { isFresh: s.isFresh, updatedAt: s.sourceUpdatedAt } : null;

const noChange = { name: false, tag: false, alliance: false, lv: false };

const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);

function eventRow(before: Sighting | undefined, after: Sighting | undefined): PlayerEventRow {
  const ref = (after ?? before) as Sighting;
  const both = before && after && before.isFresh && after.isFresh;
  return {
    eventId: ref.eventId,
    eventName: ref.eventName,
    eventAtUtc: ref.eventAtUtc,
    reference: after ? "after" : "before",
    name: ref.name,
    unionId: ref.unionId,
    tag: ref.tag,
    allianceName: ref.allianceName,
    power: ref.power,
    kills: ref.kills,
    lv: ref.lv,
    inEvent: both
      ? {
          fromPower: before.power,
          fromKills: before.kills,
          fromLv: before.lv,
          power: diff(before.power, after.power),
          kills: diff(before.kills, after.kills),
          lv: diff(before.lv, after.lv),
        }
      : null,
    step: { power: null, kills: null, lv: null, changed: noChange },
    previous: null,
    before: freshOf(before),
    after: freshOf(after),
  };
}

/** One row per event the player was seen in, with deltas vs the previous such event. */
function eventRows(sightings: Sighting[]): PlayerEventRow[] {
  const byEvent = new Map<number, { before?: Sighting; after?: Sighting }>();
  for (const s of sightings) byEvent.set(s.eventId, { ...byEvent.get(s.eventId), [s.phase]: s });
  const rows = [...byEvent.values()].map((e) => eventRow(e.before, e.after));
  const steps = seriesDeltas(
    rows.map((r) => ({
      isFresh: (r.reference === "after" ? r.after : r.before)?.isFresh ?? false,
      power: r.power,
      kills: r.kills,
      lv: r.lv,
      name: r.name,
      tag: r.tag,
      unionId: r.unionId,
    })),
  );
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    return {
      ...r,
      step: steps[i] as SeriesStep,
      previous: prev ? { name: prev.name, tag: prev.tag, unionId: prev.unionId } : null,
    };
  });
}

/** Consecutive sightings in the same alliance collapse into one stay (the alliance timeline). */
function allianceStays(sightings: Sighting[]): AllianceStay[] {
  const stays: AllianceStay[] = [];
  for (const s of sightings) {
    const last = stays.at(-1);
    if (last && last.unionId === s.unionId) {
      Object.assign(last, {
        tag: s.tag,
        name: s.allianceName,
        lastSeen: s.eventAtUtc,
        lastEventId: s.eventId,
      });
    } else {
      stays.push({
        unionId: s.unionId,
        tag: s.tag,
        name: s.allianceName,
        firstSeen: s.eventAtUtc,
        lastSeen: s.eventAtUtc,
        lastEventId: s.eventId,
      });
    }
  }
  return stays;
}

/** One player across events, by uid (§3.8). Null when no real event has a roster row for the uid. */
export async function playerHistory(db: Db, uid: number): Promise<PlayerHistory | null> {
  const sightings = await sightingsOf(db, [uid]);
  const latest = sightings.at(-1);
  if (!latest) return null;
  const sightedNames: NameSighting[] = sightings.map((s) => ({
    tag: "",
    name: s.name,
    at: s.eventAtUtc,
  }));
  return {
    uid,
    current: {
      name: latest.name,
      unionId: latest.unionId,
      tag: latest.tag,
      eventId: latest.eventId,
    },
    rows: eventRows(sightings),
    names: nameHistory(sightedNames),
    alliances: allianceStays(sightings),
  };
}

export interface PlayerMatch {
  uid: number;
  name: string;
  /** The older name that matched when the current one does not. */
  matchedName: string | null;
  unionId: number;
  tag: string | null;
  allianceName: string | null;
  lastEventId: number;
  lastSeen: Date;
}

/** `%`, `_` and `\` in the search text are literals, not wildcards. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

/** Players whose current or any earlier name contains `q` (ILIKE, §3.8): most recently seen first, at most 50. */
export async function searchPlayers(db: Db, q: string): Promise<PlayerMatch[]> {
  const text = q.trim();
  if (text === "") return [];
  const lastSeen = max(events.eventAtUtc);
  const hits = await db
    .select({ uid: memberSnapshots.uid })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(and(ilike(memberSnapshots.name, likePattern(text)), eq(events.isTest, false)))
    .groupBy(memberSnapshots.uid)
    .orderBy(desc(lastSeen), asc(memberSnapshots.uid))
    .limit(SEARCH_LIMIT);
  const uids = hits.map((h) => h.uid);
  if (uids.length === 0) return [];
  const all = await sightingsOf(db, uids);
  return uids.map((uid) => {
    const own = all.filter((s) => s.uid === uid);
    const latest = own.at(-1) as Sighting;
    const matched = own.findLast((s) => s.name.toLowerCase().includes(text.toLowerCase()));
    return {
      uid,
      name: latest.name,
      matchedName: matched && matched.name !== latest.name ? matched.name : null,
      unionId: latest.unionId,
      tag: latest.tag,
      allianceName: latest.allianceName,
      lastEventId: latest.eventId,
      lastSeen: latest.eventAtUtc,
    };
  });
}
