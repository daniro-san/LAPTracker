// Insights → KvK's map (issue 791, D71 amendment 2026-11-27): where the own alliance's members were at the
// newest KvK's End read, each dot in one of 3 bands of kills gained, and, only once the officers typed a
// castle point, how many members were near, mid-way and far from it with the kills they gained. Officers
// only, behind requireWorkspace, for the workspace's own alliance. Each dot carries its member's name, and
// each distance band names its members (D163). Places and names never go to logs, analytics or AI. Nothing
// here says why a member gained kills: the End read shows where a member was then, not where they fought.
// Each member also carries their newest Raid Shield reading before that KvK (issue 817): the night and morning
// reads of its raid, with the map scan's time as "as of". No reading is "unknown", never "unshielded" (D75).
// For the zoom levels and the detail sheet (issue 817 part 2): each member's uid (the member card's link),
// kills gained, ring and might and last seen from the newest daily update; the other tracked alliances as
// clusters (tag, members, centre only) from the daily rosters of that KvK's day (D163 amendment 2026-11-28).
import { z } from "zod";

import { dayIn } from "../calendar-time";
import type { Db } from "../db";
import { recordFailure } from "../repo/auth-attempts";
import { mapClusters, type MapCluster } from "../repo/map-clusters";
import { shieldReadings, shieldSettingsOf } from "../repo/shield-checks";
import {
  endOfDayReads,
  eventEndPlaces,
  type EventEndPlaces,
  type RosterMember,
} from "../repo/workspace-rosters";
import { castleOf, saveCastle, type CastlePoint } from "../repo/workspaces";
import {
  passWindows,
  raidOf,
  suggestionOf,
  timesOf,
  type ShieldReading,
  type ShieldSuggestion,
} from "../shield-check";
import type { WorkspaceAccess } from "./access";
import { KVK_EVENTS } from "./insights-kvk";

/** The highest map square a castle point may name; the reads hold places from 0 to 999. */
export const MAP_MAX = 999;

/** The map shows the newest KvK of about the KvK card's month (KVK_EVENTS Saturdays). */
const SINCE_MS = KVK_EVENTS * 7 * 86_400_000;

/** "none": no kills gained; "fewer": up to the gainers' median; "more": above it. */
export type KillBand = "none" | "fewer" | "more";

export type Ring = "near" | "mid" | "far";

export interface KvkMapDot {
  /** For the member card's link only. */
  uid: number;
  name: string;
  x: number;
  y: number;
  /** Null when the kills are not known on one side (not in the Start read, or no kills sent). */
  band: KillBand | null;
  /** The newest Raid Shield reading before that KvK: seen, not seen, or no reading (D75). */
  shield: ShieldSuggestion;
  /** That reading's map scan (or read) time; null with no reading. */
  shieldAt: Date | null;
  /** Kills gained in the KvK; null when not known. */
  gain: number | null;
  /** The distance band that counts the member; null without one (no castle point, kills not known). */
  ring: Ring | null;
  /** Might and last seen in game from the newest daily update; null when it sent none. */
  might: number | null;
  lastSeen: Date | null;
}

/** A third of the members with known kills, by distance from the castle point (map squares). */
export interface DistanceBand {
  band: Ring;
  from: number;
  to: number;
  members: number;
  kills: number;
  /** The band's members, in name order (D163). */
  names: string[];
}

export interface KvkMap {
  at: Date;
  endAt: Date;
  /** In name order, so the readout's steps walk the members by name. */
  dots: KvkMapDot[];
  /** The gainers' median kills gained: "fewer" is up to it, "more" above it; null with no gainer. */
  median: number | null;
  /** Members of the End read with no place in it. */
  unplaced: number;
  castle: CastlePoint | null;
  /** Near, mid, far; null without a castle point or with fewer than 3 members whose kills are known. */
  bands: DistanceBand[] | null;
  /** The newest map scan among the members' shield readings ("as of"); null with no reading. */
  shieldAt: Date | null;
  /** The other tracked alliances (tag, members, centre), and their rosters' newest time. */
  clusters: MapCluster[];
  clustersAt: Date | null;
}

const byName = (a: string, b: string) => a.localeCompare(b);

const gainOf = (p: { before: number | null; after: number | null }) =>
  p.before === null || p.after === null ? null : Math.max(0, p.after - p.before);

/** Near, mid and far thirds of `known` by distance from `castle`, each with its range and kills. */
function bandsOf(
  known: { uid: number; name: string; x: number; y: number; gain: number }[],
  castle: CastlePoint,
): (DistanceBand & { uids: number[] })[] | null {
  if (known.length < 3) return null;
  const far = known
    .map((p) => ({
      d: Math.hypot(p.x - castle.x, p.y - castle.y),
      gain: p.gain,
      name: p.name,
      uid: p.uid,
    }))
    .sort((a, b) => a.d - b.d);
  const cuts = [0, Math.round(far.length / 3), Math.round((far.length * 2) / 3), far.length];
  return (["near", "mid", "far"] as const).map((band, i) => {
    const part = far.slice(cuts[i], cuts[i + 1]);
    return {
      band,
      from: Math.round(part[0]?.d ?? 0),
      to: Math.round(part.at(-1)?.d ?? 0),
      members: part.length,
      kills: part.reduce((a, p) => a + p.gain, 0),
      names: part.map((p) => p.name).sort(byName),
      uids: part.map((p) => p.uid),
    };
  });
}

/** What the map adds beside the End read: the newest daily update's members and the other alliances. */
export interface KvkMapMore {
  roster?: Pick<RosterMember, "uid" | "power" | "lastOnlineAt">[];
  clusters?: MapCluster[];
  clustersAt?: Date | null;
}

/** The map of one End read: dots in kill bands with their shield, and near/mid/far only with a castle point. */
export function kvkMapOf(
  end: EventEndPlaces,
  castle: CastlePoint | null,
  readings: (ShieldReading & { uid: number })[] = [],
  more: KvkMapMore = {},
): KvkMap {
  const read = new Map(readings.map((r) => [r.uid, r]));
  const roster = new Map((more.roster ?? []).map((m) => [m.uid, m]));
  const gains = end.places
    .map((p) => ({ uid: p.uid, name: p.name, x: p.x, y: p.y, gain: gainOf(p) }))
    .sort((a, b) => byName(a.name, b.name));
  const up = gains.flatMap((p) => (p.gain !== null && p.gain > 0 ? [p.gain] : []));
  up.sort((a, b) => a - b);
  const median = up.length > 0 ? (up[Math.floor((up.length - 1) / 2)] as number) : null;
  const band = (gain: number | null): KillBand | null =>
    gain === null
      ? null
      : gain === 0
        ? "none"
        : median !== null && gain > median
          ? "more"
          : "fewer";
  const scans = end.places.flatMap((p) => {
    const r = read.get(p.uid);
    return r && r.shielding !== null ? [(r.mapAt ?? r.readAt).getTime()] : [];
  });
  const known = gains.flatMap((p) => (p.gain === null ? [] : [{ ...p, gain: p.gain }]));
  const banded = castle ? bandsOf(known, castle) : null;
  const ring = new Map(banded?.flatMap((b) => b.uids.map((uid) => [uid, b.band] as const)));
  return {
    at: end.at,
    endAt: end.endAt,
    dots: gains.map((p) => {
      const r = read.get(p.uid);
      const m = roster.get(p.uid);
      return {
        uid: p.uid,
        name: p.name,
        x: p.x,
        y: p.y,
        band: band(p.gain),
        shield: suggestionOf(r ?? null),
        shieldAt: r && r.shielding !== null ? (r.mapAt ?? r.readAt) : null,
        gain: p.gain,
        ring: ring.get(p.uid) ?? null,
        might: m?.power ?? null,
        lastSeen: m?.lastOnlineAt ?? null,
      };
    }),
    median,
    unplaced: end.unplaced,
    castle,
    bands: banded?.map(({ uids: _, ...b }) => b) ?? null,
    shieldAt: scans.length > 0 ? new Date(Math.max(...scans)) : null,
    clusters: more.clusters ?? [],
    clustersAt: more.clustersAt ?? null,
  };
}

/**
 * The workspace's own alliance's map as of `now`; null with no KvK End read in the last month. The shields
 * are each member's newest reading from that KvK's raid: Friday's night read to KvK's start (`zone` is ST).
 */
export async function kvkMapView(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
  zone: string,
): Promise<KvkMap | null> {
  const [end, castle, settings] = await Promise.all([
    eventEndPlaces(db, access.unionId, new Date(now.getTime() - SINCE_MS)),
    castleOf(db, access.workspaceId),
    shieldSettingsOf(db, access.workspaceId),
  ]);
  if (!end) return null;
  const day = dayIn(zone, end.at.getTime());
  const raid = raidOf(day, { SERVER_TZ: zone });
  const from = passWindows(raid.friday, { SERVER_TZ: zone }, timesOf(settings)).night.from;
  const [readings, [newest], others] = await Promise.all([
    shieldReadings(db, access.unionId, from, raid.kvk),
    endOfDayReads(db, access.unionId, 1),
    mapClusters(db, access.unionId, day),
  ]);
  return kvkMapOf(end, castle, readings, {
    roster: newest?.members ?? [],
    clusters: others.clusters,
    clustersAt: others.at,
  });
}

const square = z.number().int().min(0).max(MAP_MAX);

/** The castle point an officer saves, or both null to clear it. */
export const castleInput = z.union([
  z.object({ castleX: square, castleY: square }).strict(),
  z.object({ castleX: z.null(), castleY: z.null() }).strict(),
]);
export type CastleInput = z.infer<typeof castleInput>;

/** At most this many saves per 15 minutes per workspace: far above a person typing a point. */
const SAVES = 30;
const WINDOW_MS = 15 * 60_000;

export async function saveCastlePoint(
  db: Db,
  access: WorkspaceAccess,
  input: CastleInput,
  now: Date,
): Promise<{ ok: true } | { ok: false; code: "rate_limited" }> {
  const tries = await recordFailure(db, `castle:ws:${access.workspaceId}`, WINDOW_MS, now);
  if (tries > SAVES) return { ok: false, code: "rate_limited" };
  const { castleX, castleY } = input;
  await saveCastle(
    db,
    access.workspaceId,
    castleX === null || castleY === null ? null : { x: castleX, y: castleY },
  );
  return { ok: true };
}
