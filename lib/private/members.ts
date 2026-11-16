// The Members tab's read (issue #296): one row per member of the workspace's own alliance, from its newest
// end-of-day read (D72), with the week's donations, the D71 fields, who is new, what is missing, the
// "Check in" reasons with their evidence (D75) and the week's thanks. Rows of the workspace's alliance
// only (union_id = access.unionId, D71). avatar_url is never read.
import type { Db } from "../db";
import { roleOf } from "../queries/leadership";
import { mightUnchanged } from "../queries/might-unchanged";
import {
  endOfDayReads,
  firstSeenDays,
  scheduledEventKills,
  type EventKills,
  type RosterMember,
  type RosterRead,
} from "../repo/workspace-rosters";
import type { WorkspaceAccess } from "./access";
import {
  gameWeek,
  idleRun,
  isNewMember,
  missingOf,
  topOf,
  weekDonations,
  weekTotal,
  type DayValue,
  type Idle,
  type MissingField,
  type Thank,
} from "./member-week";

/** End-of-day reads fetched: a full week and the reads before it that the offline proxy may walk back. */
const LOOKBACK_READS = 15;
/** A scheduled event (the Saturday KvK) counts for its "no kills gained" reason for this long. */
const KVK_DAYS = 7;
const DAY_MS = 86_400_000;

/** A "Check in" reason and its evidence (D75). */
export type Reason =
  ({ kind: "idle" } & Idle) | { kind: "might"; days: number } | { kind: "kvk"; at: Date };

export interface MemberRow {
  uid: number;
  name: string;
  /** "R4 · Goddess", "R3"; null when the game sent no rank. */
  rank: string | null;
  rankCode: number | null;
  might: number | null;
  sanctuary: number | null;
  activity: number | null;
  honor: number | null;
  donations: DayValue[];
  weekTotal: number | null;
  joinedAt: Date | null;
  lastOnlineAt: Date | null;
  mapX: number | null;
  mapY: number | null;
  seenSince: string | null;
  isNew: boolean;
  reasons: Reason[];
  missing: MissingField[];
  /** Days of the week so far with no donations data. */
  missingDays: number;
}

export interface MembersView {
  /** When the newest end-of-day read was taken; null before the first one. */
  readAt: Date | null;
  /** The game week of the newest read, Monday to Sunday (server days). */
  week: string[];
  members: MemberRow[];
  thanks: { donors: Thank[]; activity: Thank[] };
}

/** The rank as the game shows it, with an R4's title by the game's name (D56). */
function rankOf(m: RosterMember): string | null {
  if (m.rankCode === null || m.rankCode < 101 || m.rankCode > 105) return m.rankLabel;
  const role = roleOf(m.rankCode, m.rankLabel);
  return role?.kind === "officer" ? `R4 · ${role.title}` : `R${m.rankCode - 100}`;
}

/** Kills gained in the event: null when either side is unknown or the member was not in both rosters. */
function killsGained(event: EventKills | null, uid: number): number | null {
  const [before, after] = [event?.before.get(uid), event?.after.get(uid)];
  return before === undefined || after === undefined || before === null || after === null
    ? null
    : after - before;
}

interface Signals {
  reads: RosterRead[];
  firstSeen: Map<number, string>;
  oldest: string;
  unchanged: Map<number, number>;
  event: EventKills | null;
}

function rowOf(m: RosterMember, week: string[], s: Signals): MemberRow {
  const newest = s.reads.at(-1) as RosterRead;
  const donations = weekDonations(s.reads, week, m.uid);
  const idle = idleRun(s.reads, m.uid);
  const flat = s.unchanged.get(m.uid);
  const reasons: Reason[] = [
    ...(idle ? [{ kind: "idle" as const, ...idle }] : []),
    ...(flat !== undefined ? [{ kind: "might" as const, days: flat }] : []),
    ...(s.event && killsGained(s.event, m.uid) === 0
      ? [{ kind: "kvk" as const, at: s.event.at }]
      : []),
  ];
  const missing = missingOf(m, donations);
  return {
    uid: m.uid,
    name: m.name,
    rank: rankOf(m),
    rankCode: m.rankCode,
    might: m.power,
    sanctuary: m.lv,
    activity: m.active,
    honor: m.dailyHonor,
    donations,
    weekTotal: weekTotal(donations),
    joinedAt: m.joinedAt,
    lastOnlineAt: m.lastOnlineAt,
    mapX: m.x,
    mapY: m.y,
    seenSince: s.firstSeen.get(m.uid) ?? null,
    isNew: isNewMember(s.firstSeen.get(m.uid), s.oldest, newest.day),
    reasons,
    missing: missing.fields,
    missingDays: missing.days,
  };
}

/** R5 first, then R4 … R1, then by might; a member without a rank or might last. */
const byRankThenMight = (a: MemberRow, b: MemberRow) =>
  (b.rankCode ?? 0) - (a.rankCode ?? 0) || (b.might ?? -1) - (a.might ?? -1);

/** The Members tab of the workspace's own alliance, as of `now`. */
export async function membersView(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
): Promise<MembersView> {
  const unionId = access.unionId;
  const [reads, firstSeen, might, event] = await Promise.all([
    endOfDayReads(db, unionId, LOOKBACK_READS),
    firstSeenDays(db, unionId),
    mightUnchanged(db, unionId),
    scheduledEventKills(db, unionId, new Date(now.getTime() - KVK_DAYS * DAY_MS)),
  ]);
  const newest = reads.at(-1);
  if (!newest) return { readAt: null, week: [], members: [], thanks: { donors: [], activity: [] } };
  const week = gameWeek(newest.day);
  const signals: Signals = {
    reads,
    firstSeen,
    oldest: [...firstSeen.values()].reduce((a, b) => (b < a ? b : a), newest.day),
    unchanged: new Map(might.unchanged.map((u) => [u.uid, u.days])),
    event,
  };
  const members = newest.members.map((m) => rowOf(m, week, signals)).sort(byRankThenMight);
  return {
    readAt: newest.at,
    week,
    members,
    thanks: {
      donors: topOf(members, (m) => m.weekTotal),
      activity: topOf(members, (m) => m.activity),
    },
  };
}
