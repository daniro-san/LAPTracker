// The Members tab's read (issue #296): one row per member of the workspace's own alliance, from its newest
// end-of-day read (D72), with the week's donations, the D71 fields, who is new, what is missing, the
// "Check in" reasons with their evidence (D75), the week's thanks and the officers' member facts (#297).
// A member on a break (an officer's status, or an away note with an end day not past) has no reasons and
// no place in the thanks (D75). Before the alliance's first end-of-day read, the rows come from its newest
// roster of any kind, with nothing computed from it. Rows of the workspace's alliance only (union_id =
// access.unionId, D71). avatar_url is never read.
import type { Db } from "../db";
import { roleOf } from "../queries/leadership";
import { mightUnchanged } from "../queries/might-unchanged";
import { photosOf, type Photo } from "../queries/photo";
import { factHistorySince, type FactRow } from "../repo/member-facts";
import { openPendings } from "../repo/pending-members";
import { anyRoster, namesSeen, type AnyRoster } from "../repo/workspace-any-roster";
import {
  endOfDayReads,
  firstSeenDays,
  scheduledEventKills,
  type EventKills,
  type RosterMember,
  type RosterRead,
} from "../repo/workspace-rosters";
import { serverDay } from "../schedule";
import type { WorkspaceAccess } from "./access";
import { awayUntil, type MemberFacts, type OfficerStatus } from "./fact-fields";
import { progressOf, thanksWeek, TREND_FIELDS, type Progress } from "./fact-trend";
import { duelSaved } from "./import-save";
import type { DuelSaved } from "./import-view";
import { factsOf, usedZones } from "./member-facts";
import {
  DAY_MS,
  gameWeek,
  idleRun,
  isNewMember,
  KVK_REASON_ON,
  missingOf,
  OFFLINE_GRACE_DAYS,
  topOf,
  weekDonations,
  weekQuestPoints,
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
  /** Lifetime kills from the read (public); null when not sent. */
  kills: number | null;
  sanctuary: number | null;
  /** Daily quest points in the newest end-of-day read (D127); null when it sent none. */
  activity: number | null;
  /** The newest read's server day when it sent no daily quest points: none that day (D127). */
  noQuestsOn: string | null;
  /** The newest read's server day when it sent no donations: none that day (D127). */
  noDonationsOn: string | null;
  honor: number | null;
  donations: DayValue[];
  weekTotal: number | null;
  joinedAt: Date | null;
  lastOnlineAt: Date | null;
  mapX: number | null;
  mapY: number | null;
  /** Alliance Duel points saved from photos for the week (issue 299): `week` and `mon` … `sat`. */
  duel: DuelSaved;
  seenSince: string | null;
  isNew: boolean;
  /** First seen under OFFLINE_GRACE_DAYS ago (D127): no offline signal and no coins tip (D140) yet. */
  settling: boolean;
  reasons: Reason[];
  missing: MissingField[];
  /** Days of the week so far with no read of the member (no donations data). */
  missingDays: number;
  /** The officers' facts about the member (#297). */
  facts: MemberFacts;
  /** A status an officer set (D75): On a break or Needs help. */
  officerStatus: OfficerStatus | null;
  /** The last day of an away note that still runs; the member is On a break until then. */
  awayUntil: string | null;
  /** From a roster read before the first end-of-day read: nothing computed, no status. */
  early: boolean;
}

export interface MembersView {
  /** When the rows were read: the newest end-of-day read, or the roster before one; null when none. */
  readAt: Date | null;
  /** True before the alliance's first end-of-day read: the rows are its newest roster of any kind. */
  early: boolean;
  /** The game week of the newest read, Monday to Sunday (server days). */
  week: string[];
  members: MemberRow[];
  /** Top donors and quest points this week, and who made progress (AD Tech 100 %, main squad, D109). */
  thanks: { donors: Thank[]; activity: Thank[]; progress: Progress[] };
  /** The time zones the members have, most used first (the picker lists them first). */
  zones: string[];
  /**
   * Every fact of the workspace by uid, members or not (pending members' too, D106), read once per view
   * so the Members tab does not read them again.
   */
  facts: Map<number, MemberFacts>;
  /** The end-of-day reads the view was made from, oldest first (none before the first), for Follow-up's
   * coins tip, so they are not fetched twice. */
  reads: RosterRead[];
}

/** The rank as the game shows it, with an R4's title by the game's name (D56). */
export function rankOf(m: Pick<RosterMember, "rankCode" | "rankLabel">): string | null {
  if (m.rankCode === null || m.rankCode < 101 || m.rankCode > 105) return m.rankLabel;
  const role = roleOf(m.rankCode, m.rankLabel);
  return role?.kind === "officer" ? `R4 · ${role.title}` : `R${m.rankCode - 100}`;
}

/** Kills gained in the event: null when either side is unknown or the member was not in both rosters. */
export function killsGained(event: EventKills | null, uid: number): number | null {
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
  duel: Map<number, DuelSaved>;
  facts: Map<number, MemberFacts>;
  /** Today's server day, for away notes. */
  today: string;
}

/** The member's facts, the status an officer set, and an away note that still runs. */
function factsPart(uid: number, s: Pick<Signals, "facts" | "today">) {
  const facts = s.facts.get(uid) ?? {};
  return {
    facts,
    officerStatus: facts.status?.value ?? null,
    awayUntil: awayUntil(facts.away?.value, s.today),
  };
}

const onBreak = (p: ReturnType<typeof factsPart>) =>
  p.officerStatus === "break" || p.awayUntil !== null;

function rowOf(m: RosterMember, week: string[], s: Signals): MemberRow {
  const newest = s.reads.at(-1) as RosterRead;
  const donations = weekDonations(s.reads, week, m.uid);
  const firstSeen = s.firstSeen.get(m.uid);
  const isNew = isNewMember(firstSeen, s.oldest, newest.day);
  // D127: a member first seen less than OFFLINE_GRACE_DAYS ago never gets the offline signal.
  const settling = isNewMember(firstSeen, s.oldest, newest.day, OFFLINE_GRACE_DAYS);
  const idle = settling ? null : idleRun(s.reads, m.uid);
  const flat = s.unchanged.get(m.uid);
  const part = factsPart(m.uid, s);
  // D75: a member away is left out of every comparison, so never a reason to check in.
  const reasons: Reason[] = onBreak(part)
    ? []
    : [
        ...(idle ? [{ kind: "idle" as const, ...idle }] : []),
        ...(flat !== undefined ? [{ kind: "might" as const, days: flat }] : []),
        ...(s.event && killsGained(s.event, m.uid) === 0
          ? [{ kind: "kvk" as const, at: s.event.at }]
          : []),
      ];
  const missing = missingOf(m, donations);
  return {
    ...plainRow(m, week, s.firstSeen),
    activity: m.active,
    noQuestsOn: m.active === null ? newest.day : null,
    noDonationsOn: m.dailyTech === null ? newest.day : null,
    honor: m.dailyHonor,
    donations,
    weekTotal: weekTotal(donations),
    joinedAt: m.joinedAt,
    lastOnlineAt: m.lastOnlineAt,
    mapX: m.x,
    mapY: m.y,
    duel: s.duel.get(m.uid) ?? {},
    isNew,
    settling,
    reasons,
    missing: missing.fields,
    missingDays: missing.days,
    ...part,
    early: false,
  };
}

/** A row from a roster before the first end-of-day read: what the roster has, "—" for the rest. */
function plainRow(m: RosterMember, week: string[], firstSeen: Map<number, string>) {
  return {
    uid: m.uid,
    name: m.name,
    rank: rankOf(m),
    rankCode: m.rankCode,
    might: m.power,
    kills: m.kills,
    sanctuary: m.lv,
    activity: null,
    noQuestsOn: null,
    noDonationsOn: null,
    honor: null,
    donations: week.map(() => null),
    weekTotal: null,
    joinedAt: null,
    lastOnlineAt: null,
    mapX: null,
    mapY: null,
    duel: {},
    seenSince: firstSeen.get(m.uid) ?? null,
    isNew: false,
    settling: false,
    reasons: [],
    missing: [],
    missingDays: 0,
  };
}

function earlyView(
  roster: AnyRoster | null,
  s: Pick<Signals, "facts" | "today" | "firstSeen"> & { pending: readonly number[] },
  zone: string,
): MembersView {
  const none = { donors: [], activity: [], progress: [] };
  if (!roster)
    return {
      readAt: null,
      early: true,
      week: [],
      members: [],
      thanks: none,
      zones: [],
      facts: s.facts,
      reads: [],
    };
  const week = gameWeek(serverDay(roster.at, { SERVER_TZ: zone }));
  const members = roster.members
    .map((m) => ({ ...plainRow(m, week, s.firstSeen), ...factsPart(m.uid, s), early: true }))
    .sort(order);
  const zones = usedZones(s.facts, [...roster.members.map((m) => m.uid), ...s.pending]);
  const view = {
    readAt: roster.at,
    early: true,
    week,
    members,
    thanks: none,
    zones,
    facts: s.facts,
  };
  return { ...view, reads: [] };
}

/** Check in first; then R5, R4 … R1, then by might; a member without a rank or might last. */
const order = (a: MemberRow, b: MemberRow) =>
  Number(b.reasons.length > 0) - Number(a.reasons.length > 0) ||
  (b.rankCode ?? 0) - (a.rankCode ?? 0) ||
  (b.might ?? -1) - (a.might ?? -1);

/**
 * The main squad and AD Tech versions the week's progress compares (D109), for the thanks week of `now`
 * (`zone` is SERVER_TZ): those saved from a day before the week's Monday on, and the version before them.
 * A day of room covers any server zone's offset, and progressOf splits the week by server day itself, so
 * the thanks are those of the whole history (issue 521, D149).
 */
export const progressHistory = (db: Db, access: WorkspaceAccess, now: Date, zone: string) =>
  factHistorySince(
    db,
    access.workspaceId,
    TREND_FIELDS,
    new Date(Date.parse(`${thanksWeek(serverDay(now, { SERVER_TZ: zone }))}T00:00:00Z`) - DAY_MS),
  );

/** The Members tab with the week's progress in its thanks (D109), as Home and Members show it. */
export const membersWithProgress = (db: Db, access: WorkspaceAccess, now: Date, zone: string) =>
  progressHistory(db, access, now, zone).then((h) => membersView(db, access, now, zone, h));

/** The Members tab of the workspace's own alliance, as of `now`; `zone` is the server's (SERVER_TZ). */
export async function membersView(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
  zone: string,
  /**
   * The thanks week's main squad and AD Tech versions (`progressHistory`), passed only by the pages that
   * show the week's progress (Members, Home); without it `thanks.progress` is empty (D109).
   */
  history?: readonly FactRow[],
): Promise<MembersView> {
  const unionId = access.unionId;
  const [reads, firstSeen, might, event, facts, pendingRows] = await Promise.all([
    endOfDayReads(db, unionId, LOOKBACK_READS),
    firstSeenDays(db, unionId),
    mightUnchanged(db, unionId),
    KVK_REASON_ON
      ? scheduledEventKills(db, unionId, new Date(now.getTime() - KVK_DAYS * DAY_MS))
      : null,
    factsOf(db, access),
    openPendings(db, access.workspaceId),
  ]);
  // Open new members' uids (D106): their zones count among the alliance's.
  const pending = pendingRows.map((p) => -p.id);
  const today = serverDay(now, { SERVER_TZ: zone });
  const newest = reads.at(-1);
  if (!newest)
    return earlyView(await anyRoster(db, unionId), { facts, today, firstSeen, pending }, zone);
  const week = gameWeek(newest.day);
  const signals: Signals = {
    reads,
    firstSeen,
    oldest: [...firstSeen.values()].reduce((a, b) => (b < a ? b : a), newest.day),
    unchanged: new Map(might.unchanged.map((u) => [u.uid, u.days])),
    event,
    duel: await duelSaved(db, access, week[0] as string),
    facts,
    today,
  };
  const members = newest.members.map((m) => rowOf(m, week, signals)).sort(order);
  // D75: thanks are a comparison, so members on a break are left out of them.
  const counted = members.filter((m) => !onBreak(m));
  return {
    readAt: newest.at,
    early: false,
    week,
    members,
    thanks: {
      donors: topOf(counted, (m) => m.weekTotal),
      activity: topOf(counted, (m) => weekQuestPoints(reads, m.uid)),
      // The week the thanks cover (D114): this game week, or last week on a Monday.
      progress: history ? progressOf(history, counted, thanksWeek(today), zone) : [],
    },
    zones: usedZones(facts, [...newest.members.map((m) => m.uid), ...pending]),
    facts,
    reads,
  };
}

/** A member as the list page shows them: the photo and frame, and the names they used before here. */
export type ListSource = MemberRow & { photo: Photo; pastNames: string[] };

const NO_PHOTO: Photo = { hasAvatar: false, frameId: null };

/**
 * The list page's own read (issue 337), apart from `membersView` so the card route never runs it: each
 * member's photo and frame (as the public pages show them) and their past names in this alliance's
 * rosters, newest first.
 */
export async function withListExtras(
  db: Db,
  access: WorkspaceAccess,
  members: MemberRow[],
): Promise<ListSource[]> {
  const [photos, names] = await Promise.all([
    photosOf(
      db,
      members.map((m) => m.uid),
    ),
    namesSeen(db, access.unionId),
  ]);
  return members.map((m) => ({
    ...m,
    photo: photos.get(m.uid) ?? NO_PHOTO,
    pastNames: (names.get(m.uid) ?? []).filter((n) => n !== m.name),
  }));
}
