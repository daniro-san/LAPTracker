// The officers' Insights page's read (issue 489): the workspace's own alliance's end-of-day reads (D72),
// the day each member was first seen, the officers' break notes (D75: members on a break and new members
// are left out of the effort comparison), and for the people who joined or left, the public daily rosters
// of the other alliances we read and the alliance tags in our members' own /v1/players history rows (D132,
// D136). While the Raid Shield check is on (D134), its weekly counts of the night and morning checks'
// readings (D137), counts only. The members' recorded time zones, counted (owner, 2026-11-22). A count that stands for a set of members carries the set's uids, and the count is its length (#678). Everything is already stored: no upstream call. x, y, online, last_online_at and joined_at are never used; avatar_url is never read.
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import type { Db } from "../db";
import { sightingsElsewhere } from "../queries/roster-stays";
import { allianceLabels, type AllianceLabel } from "../repo/alliances";
import { shieldPassCounts } from "../repo/shield-checks";
import { latestSquadSightings } from "../repo/squads";
import { endOfDayReads, firstSeenDays, scheduledEventMight } from "../repo/workspace-rosters";
import { serverDay } from "../schedule";
import { playerHistory } from "../schema-squads";
import type { WorkspaceAccess } from "./access";
import { addDays, dayIn } from "./calendar-time";
import { awayUntil } from "./fact-fields";
import { featureOn } from "./features";
import { kvkGroupOpen } from "./follow-up-kvk";
import { helpStands } from "./follow-up-rules";
import { KVK_READ_FROM, kvkOf, type KvkView } from "./insights-kvk";
import {
  bandsOf,
  cameFrom,
  EFFORT_MIN_READS,
  EFFORT_READS,
  effortsOf,
  flowDays,
  movesOf,
  newcomersOf,
  pulseDays,
  pulseView,
  PULSE_WEEKS,
  quietOf,
  tenureOf,
  wentTo,
  type Band,
  type Effort,
  type Elsewhere,
  type FlowDay,
  type Place,
  type PulseView,
} from "./insights-rules";
import { shieldFridays, shieldWeeksOf, shieldWindows, type ShieldWeek } from "./insights-shield";
import { squadsCoverageOf, type SquadsCoverage } from "./insights-squads";
import { zoneCountsOf, type ZoneCounts } from "./insights-zones";
import { factsOf } from "./member-facts";
import { isNewMember } from "./member-week";

/** End-of-day reads fetched: the PULSE_WEEKS weeks and the read before them, the base of the first move. */
const READS = PULSE_WEEKS * 7 + 1;
/** How far back before the first change another alliance's rosters are searched for where someone was. */
const SIGHTING_DAYS = 60;

export interface InsightsView {
  /** The newest read's day; null before the alliance's first end-of-day read. */
  newest: string | null;
  pulse: PulseView | null;
  /**
   * An earlier week of the pulse, day by day, when the address asks for it (`?pulse=<monday>`) and the pulse
   * has that week with a read; null otherwise. This week's days are `pulse.days`.
   */
  pulseWeek: { monday: string; days: PulseView["days"] } | null;
  effort: {
    /** The reads averaged over: the first and last day, and how many. */
    from: string;
    to: string;
    reads: number;
    members: number;
    /** Left out of the comparison (D75): new, on a break, no might in the newest read (uids). */
    leftOut: { fresh: number[]; away: number[]; noMight: number[] };
    bands: Band[];
    quiet: Effort[];
  } | null;
  flow: {
    /** The first day a change can be seen (the second read in the window). */
    from: string;
    /** The read the first change is seen against (the one before `from`): the card's one start date. */
    since: string;
    /** End-of-day reads from `since` on. */
    reads: number;
    /** Who joined and who left in each week (uids), and on each of its days (D158 rule 7 (b)). */
    weeks: { monday: string; joined: number[]; left: number[]; days: FlowDay[] }[];
    cameFrom: Place[];
    wentTo: Place[];
    /** Members first seen under 14, 30, 90 days ago, more, and since our first read (its day). */
    tenure: ReturnType<typeof tenureOf>;
    firstRead: string;
    newcomers: ReturnType<typeof newcomersOf>;
  } | null;
  /** KvK cost and recovery: the newest scheduled events inside the reads, and why none may show yet. */
  kvk: KvkView;
  /** Follow-up's "After KvK, offer help" has someone in it, so the help list links to it (#585 S5). */
  kvkFollowUp: boolean;
  /** Squads seen, counts only; null with the squads read turned off (D126). */
  squads: SquadsCoverage | null;
  /** Raid Shield history, the newest week first; null with the Raid Shield check turned off (D134). */
  shield: ShieldWeek[] | null;
  /** The newest daily update's members by their recorded time zone, counts only (owner, 2026-11-22). */
  zones: ZoneCounts;
  labels: Map<number, AllianceLabel>;
  /**
   * The name of everyone a set can hold (#678): the newest read's members (`current`) and the flow's
   * joiners and leavers who are not in it.
   */
  people: Map<number, { name: string; current: boolean }>;
  /** The newest read's members, for the thanks sheet's "Add someone else". */
  roster: { uid: number; name: string }[];
}

/** The alliance tags our members' history rows carried, by day (D132; this alliance's rows only). */
async function historyTags(db: Db, access: WorkspaceAccess, uids: number[], zone: string) {
  if (uids.length === 0) return [];
  const rows = await db
    .select({
      uid: playerHistory.uid,
      t: playerHistory.t,
      unionId: playerHistory.playerUnionId,
      tag: playerHistory.unionAbbr,
    })
    .from(playerHistory)
    .where(
      and(
        eq(playerHistory.unionId, access.unionId),
        inArray(playerHistory.uid, uids),
        isNotNull(playerHistory.playerUnionId),
      ),
    );
  return rows.map((h) => ({
    uid: h.uid,
    day: dayIn(zone, h.t.getTime()),
    unionId: h.unionId as number,
    tag: h.tag || null,
  }));
}

type Reads = Awaited<ReturnType<typeof endOfDayReads>>;
type Facts = Awaited<ReturnType<typeof factsOf>>;

/** The newest read's members on a break (an officer's status or an away note that still runs). */
function awayOf(newest: Reads[number], facts: Facts, today: string): Set<number> {
  return new Set(
    newest.members
      .filter((m) => {
        const f = facts.get(m.uid);
        return f?.status?.value === "break" || awayUntil(f?.away?.value, today) !== null;
      })
      .map((m) => m.uid),
  );
}

/** Effort in each quarter of might; new members and members on a break are left out (D75). */
function effortPart(
  reads: Reads,
  firstSeen: Map<number, string>,
  oldest: string,
  away: Set<number>,
): InsightsView["effort"] {
  const newest = reads.at(-1) as Reads[number];
  const fresh = new Set(
    newest.members
      .filter((m) => !away.has(m.uid) && isNewMember(firstSeen.get(m.uid), oldest, newest.day))
      .map((m) => m.uid),
  );
  const efforts = effortsOf(reads, new Set([...away, ...fresh]));
  const recent = reads.slice(-EFFORT_READS);
  // Too few reads: no groups and no names (persona panel: one day says too little about anyone).
  const enough = recent.length >= EFFORT_MIN_READS;
  return {
    from: recent[0]?.day ?? newest.day,
    to: newest.day,
    reads: recent.length,
    members: efforts.length,
    leftOut: {
      fresh: [...fresh],
      away: [...away],
      noMight: newest.members
        .filter((m) => m.power === null && !away.has(m.uid) && !fresh.has(m.uid))
        .map((m) => m.uid),
    },
    bands: enough ? bandsOf(efforts) : [],
    quiet: enough ? quietOf(efforts) : [],
  };
}

/** Joined and left per week of the pulse, where people came from and went, tenure and newcomers. */
async function flowPart(
  db: Db,
  access: WorkspaceAccess,
  reads: Reads,
  weeks: string[],
  firstSeen: Map<number, string>,
  oldest: string,
  zone: string,
) {
  const newest = reads.at(-1) as Reads[number];
  const first = reads.findIndex((r, i) => i > 0 && r.day >= (weeks[0] ?? ""));
  const from = reads[first]?.day ?? newest.day;
  const since = reads[first - 1]?.day ?? from;
  const moves = movesOf(reads, from);
  const moved = [...new Set([...moves.joined, ...moves.left].map((m) => m.uid))];
  const [rosters, tags] = await Promise.all([
    sightingsElsewhere(db, moved, access.unionId, addDays(from, -SIGHTING_DAYS)),
    historyTags(db, access, [...new Set(moves.joined.map((j) => j.uid))], zone),
  ]);
  const seen: Elsewhere[] = [...rosters, ...tags];
  const came = cameFrom(moves.joined, seen, access.unionId);
  const went = wentTo(moves.left, seen, access.unionId);
  const labels = await allianceLabels(db, [
    ...new Set([...came, ...went].map((p) => p.unionId).filter((id) => id > 0)),
  ]);
  const inWeek = (list: { uid: number; day: string }[], monday: string) =>
    list.filter((m) => m.day >= monday && m.day < addDays(monday, 7)).map((m) => m.uid);
  const readDays = new Set(reads.map((r) => r.day));
  const flow: InsightsView["flow"] = {
    from,
    since,
    reads: reads.filter((r) => r.day >= since).length,
    weeks: weeks.map((monday) => ({
      monday,
      joined: inWeek(moves.joined, monday),
      left: inWeek(moves.left, monday),
      days: flowDays(moves, monday, readDays, from, newest.day),
    })),
    cameFrom: came,
    wentTo: went,
    tenure: tenureOf(
      newest.members.map((m) => m.uid),
      firstSeen,
      oldest,
      newest.day,
    ),
    firstRead: oldest,
    newcomers: newcomersOf(reads, firstSeen, oldest),
  };
  return { flow, labels, moves };
}

/**
 * Everyone a set can name (#678): the flow's joiners and leavers, then the newest read's members, who are
 * current whatever the flow saw of them (a later entry wins).
 */
const peopleOf = (newest: Reads[number], moves: ReturnType<typeof movesOf>) =>
  new Map<number, { name: string; current: boolean }>([
    ...[...moves.left, ...moves.joined].map(
      (m) => [m.uid, { name: m.name, current: false }] as const,
    ),
    ...newest.members.map((m) => [m.uid, { name: m.name, current: true }] as const),
  ]);

/** The page before the alliance's first end-of-day read. */
const noReadYet = (): InsightsView => ({
  newest: null,
  pulse: null,
  pulseWeek: null,
  effort: null,
  flow: null,
  kvk: { events: [], waiting: null, readsFrom: null },
  kvkFollowUp: false,
  squads: null,
  shield: null,
  zones: { members: 0, zones: [] },
  labels: new Map(),
  people: new Map(),
  roster: [],
});

/** The earlier pulse week `monday` names, day by day, when the pulse has it with a read. */
function pulseWeekOf(reads: Reads, pulse: PulseView | null, monday: string | null) {
  const week = pulse?.weeks.slice(0, -1).find((w) => w.monday === monday && w.reads > 0);
  return week ? { monday: week.monday, days: pulseDays(reads, week.monday) } : null;
}

/**
 * The Insights page of the workspace's own alliance, as of `now`; `zone` is the server's (SERVER_TZ).
 * `pulseWeek` is the Monday of the pulse week the address opens to its days (`?pulse=`), if any.
 */
export async function insightsView(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
  zone: string,
  pulseWeek: string | null = null,
): Promise<InsightsView> {
  const [reads, firstSeen, facts] = await Promise.all([
    endOfDayReads(db, access.unionId, READS),
    firstSeenDays(db, access.unionId),
    factsOf(db, access),
  ]);
  const newest = reads.at(-1);
  if (!newest) return noReadYet();
  const oldest = [...firstSeen.values()].reduce((a, b) => (b < a ? b : a), newest.day);
  const pulse = pulseView(reads);
  const weeks = (pulse?.weeks ?? []).map((w) => w.monday);
  const squadsOn = featureOn(access, "squads");
  const today = serverDay(now, { SERVER_TZ: zone });
  const away = awayOf(newest, facts, today);
  const fridays = featureOn(access, "shield_check") ? shieldFridays(today, now, zone) : null;
  // One KvK week before the events shown, so the card can say the KvK just before the reads is not shown.
  const since = new Date(
    Date.parse(`${addDays(reads[0]?.day ?? newest.day, KVK_READ_FROM)}T00:00:00Z`),
  );
  const [{ flow, labels, moves }, events, sightings, passes] = await Promise.all([
    flowPart(db, access, reads, weeks, firstSeen, oldest, zone),
    scheduledEventMight(db, access.unionId, since),
    squadsOn ? latestSquadSightings(db, access.unionId) : [],
    fridays ? shieldPassCounts(db, access.unionId, shieldWindows(fridays, zone)) : [],
  ]);
  const kvk = kvkOf(events, reads, zone, away, now);
  // Members whose Needs help mark stands sit in Follow-up's Needs help group, not in the KvK one.
  const marked = new Set(
    newest.members
      .filter((m) => {
        const f = facts.get(m.uid);
        return helpStands({
          officerStatus: f?.status?.value ?? null,
          awayUntil: awayUntil(f?.away?.value, today),
        });
      })
      .map((m) => m.uid),
  );
  return {
    newest: newest.day,
    pulse,
    pulseWeek: pulseWeekOf(reads, pulse, pulseWeek),
    effort: effortPart(reads, firstSeen, oldest, away),
    flow,
    kvk,
    kvkFollowUp: await kvkGroupOpen(db, access, kvk, marked, now, zone),
    squads: squadsOn
      ? squadsCoverageOf(
          newest.members.map((m) => m.uid),
          sightings,
          now,
        )
      : null,
    shield: fridays ? shieldWeeksOf(fridays, passes) : null,
    zones: zoneCountsOf(
      newest.members.map((m) => m.uid),
      facts,
    ),
    labels,
    people: peopleOf(newest, moves),
    roster: newest.members.map((m) => ({ uid: m.uid, name: m.name })),
  };
}
