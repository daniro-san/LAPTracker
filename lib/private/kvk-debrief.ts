// Insights → KvK → Debrief (issue 872): the post-war meeting on one screen, from data already stored (0
// upstream calls). Officers only, behind requireWorkspace, for the workspace's own alliance (D71). The KvK is
// the one the KvK map shows (the newest public scheduled event of the last 4 weeks with a fresh Start and End);
// an Origin of Chaos week has no debrief (#806). Thanks: the kills gained per member as the KvK recap counts
// them (D159 post 5, `recapKills` and `killsTurnout`), only members who gained kills, in name order. Roll call:
// the ✓ marks of that KvK's Raid prep (D103, D137), in name order. Map: kills gained by distance band, counts
// only. Recovery: Insights' KvK cost and recovery for that KvK. Opponent: the matchup's Start to End (D152),
// sums only, while the `kvk-matchup` flag is on. Nobody is ranked and nobody who gained nothing is named (D75).
import { killsTurnout } from "../compute";
import type { Db } from "../db";
import type { KvkLine } from "../event-image-kvk";
import type { MemberChange } from "../kvk";
import { eventMatchup, type EventMatchup } from "../queries/kvk";
import { recordFailure } from "../repo/auth-attempts";
import { callsOfWeeks, newestMarks, type MarkRow } from "../repo/roll-call";
import {
  endOfDayReads,
  eventEndPlaces,
  recapKills,
  scheduledEventMight,
  type RecapMember,
  type RosterRead,
} from "../repo/workspace-rosters";
import { castleOf } from "../repo/workspaces";
import { isKvkDay, type ScheduleConfig } from "../schedule";
import { raidOf } from "../shield-check";
import type { WorkspaceAccess } from "./access";
import { dayIn, mondayOf } from "./calendar-time";
import { KVK_EVENTS, kvkOf, type KvkEvent } from "./insights-kvk";
import { kvkMapOf, type Ring } from "./kvk-map";
import { raidOpponentView, type RaidOpponentView } from "./raid-opponent";

/** The KvK map's month: the debrief is for the KvK it shows. */
const SINCE_MS = KVK_EVENTS * 7 * 86_400_000;
/** Daily updates read: from the day before that KvK to today, at most the month and a day or two. */
const READS = KVK_EVENTS * 7 + 2;

export interface KvkDebrief {
  /** The KvK's server day. */
  day: string;
  /** Members who gained kills, in name order, with their gain (never a zero or a fall). */
  thanks: { uid: number; name: string; gain: number }[];
  /** Members in both the Start and End reads, and the kills the gainers gained together. */
  counted: number;
  gained: number;
  /** That KvK's Raid prep ✓ marks by name, in name order; null with no Raid prep that week. */
  rollCall: { shield: string[]; wall: string[] } | null;
  /** Near, mid and far: members and kills gained only; null without a castle point or with too few. */
  bands: { band: Ring; members: number; kills: number }[] | null;
  castle: boolean;
  /** Insights' cost and recovery of that KvK, without its per-member lists; null before a daily update. */
  recovery: KvkEvent | null;
  /** The matchup's Start to End, each side's sums; null with no opponent, before the End, or flag off. */
  opponent: KvkLine | null;
  /**
   * With no matchup: that KvK's raid opponent (issue 861, D165) and each side's Start→End of the raid; null
   * with none set, with Raid prep's check off, or while either side lacks a usable read.
   */
  raid: { tag: string; server: number; us: MemberChange; them: MemberChange } | null;
}

/** At most this many card renders per workspace per hour: far above officers saving a card or two. */
export const CARD_RENDERS = 10;
const CARD_WINDOW_MS = 3_600_000;

/** Counts one card render of the workspace; false once it is past CARD_RENDERS this hour. */
export async function cardRenderAllowed(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
): Promise<boolean> {
  const tries = await recordFailure(
    db,
    `debrief-card:ws:${access.workspaceId}`,
    CARD_WINDOW_MS,
    now,
  );
  return tries <= CARD_RENDERS;
}

const byName = (a: string, b: string) => a.localeCompare(b);

type Recap = { before: RecapMember[]; after: RecapMember[] } | null | undefined;

/** Post 5's counting (D159): the gainers in name order with their gain, how many counted, the sum. */
function thanksOf(recap: Recap) {
  if (!recap) return { thanks: [], counted: 0, gained: 0 };
  const turnout = killsTurnout(recap.before, recap.after);
  const was = new Map(recap.before.map((m) => [m.uid, m.kills ?? 0]));
  const gainers = new Set(turnout.gainerUids);
  const thanks = recap.after
    .filter((m) => gainers.has(m.uid))
    .map((m) => ({ uid: m.uid, name: m.name, gain: (m.kills ?? 0) - (was.get(m.uid) ?? 0) }))
    .sort((a, b) => byName(a.name, b.name));
  return { thanks, counted: turnout.n, gained: turnout.gained };
}

/** Public names (D22): the event's Start and End, else the newest daily update's. */
function namesOf(reads: readonly RosterRead[], recap: Recap): Map<number, string> {
  const names = new Map((reads.at(-1)?.members ?? []).map((m) => [m.uid, m.name]));
  for (const m of [...(recap?.before ?? []), ...(recap?.after ?? [])]) names.set(m.uid, m.name);
  return names;
}

/** The ✓ marks by public name, in name order; a member with no known name is left out. */
const ticked = (marks: readonly MarkRow[], names: ReadonlyMap<number, string>) =>
  marks
    .flatMap((m) => {
      const name = names.get(m.uid);
      return m.mark === "yes" && name !== undefined ? [name] : [];
    })
    .sort(byName);

/** Each side's Start to End, once the End has run and both sides count an alliance. */
function opponentOf(m: EventMatchup | null): KvkLine | null {
  const us = m?.matchup.us.change;
  const them = m?.matchup.them.change;
  return m?.ended && us && them ? { server: m.server, us, them } : null;
}

/** The raid opponent's tag and server and both sides' Start→End, once both sides have usable reads. */
function raidResultOf(view: RaidOpponentView | null): KvkDebrief["raid"] {
  const o = view?.opponent;
  const us = view?.result?.us.change;
  const them = view?.result?.them.change;
  return o && us && them ? { tag: o.tag, server: o.server, us, them } : null;
}

/** That KvK's Raid prep: the week's Raid Shield roll call whose raid is that Saturday, and its marks. */
async function prepOf(db: Db, access: WorkspaceAccess, day: string, zone: string) {
  const calls = await callsOfWeeks(db, access.workspaceId, [mondayOf(day)]);
  const prep = calls.find(
    (c) => c.kind === "shield" && raidOf(c.day, { SERVER_TZ: zone }).saturday === day,
  );
  if (!prep) return null;
  const [shield, wall] = await Promise.all([
    newestMarks(db, [prep.id]),
    newestMarks(db, [prep.id], "wall"),
  ]);
  return { shield, wall };
}

/**
 * The debrief of the own alliance's newest KvK as of `now`; null with no KvK End read in the last 4 weeks, or
 * when that event is an Origin of Chaos. `matchup`: the `kvk-matchup` flag (D91), so the opponent shows only
 * where the event page shows it; `cfg`: the schedule, for the raid opponent's read times.
 */
export async function kvkDebriefView(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
  { cfg, matchup }: { cfg: ScheduleConfig; matchup: boolean },
): Promise<KvkDebrief | null> {
  const zone = cfg.SERVER_TZ;
  const end = await eventEndPlaces(db, access.unionId, new Date(now.getTime() - SINCE_MS));
  if (!end) return null;
  const day = dayIn(zone, end.at.getTime());
  if (!isKvkDay(day)) return null;
  const [castle, recap, events, reads, prep] = await Promise.all([
    castleOf(db, access.workspaceId),
    recapKills(db, access.unionId, end.at, new Date(end.at.getTime() + 1)),
    scheduledEventMight(db, access.unionId, end.at),
    endOfDayReads(db, access.unionId, READS),
    prepOf(db, access, day, zone),
  ]);
  const event = events.find((e) => e.at.getTime() === end.at.getTime());
  const opponent = opponentOf(matchup && event ? await eventMatchup(db, event.id) : null);
  const raid = opponent ? null : raidResultOf(await raidOpponentView(db, access, day, cfg, now));
  const names = namesOf(reads, recap);
  const bands = kvkMapOf(end, castle).bands;
  const recovery = kvkOf(events, reads, zone, new Set(), now).events.find((e) => e.day === day);
  return {
    day,
    ...thanksOf(recap),
    rollCall: prep && { shield: ticked(prep.shield, names), wall: ticked(prep.wall, names) },
    bands: bands && bands.map(({ band, members, kills }) => ({ band, members, kills })),
    castle: castle !== null,
    recovery: recovery ? { ...recovery, people: [], help: [] } : null,
    opponent,
    raid,
  };
}
