// What the Roll call pages read (issue 298, D103), inside one workspace (D71): the week's occasions with
// their counts, one roll call's rows, and an Elixir Scramble team with its suggestions. Away members (an
// away note running on the occasion's day, or On a break, D80) are left out of the answers. The week's
// daily quest points (D127) stay in here: the team page gets "Quests this week" and the order, never the
// number (D76). A deleted roll call is in none of these reads; an archived one is only in the archived list
// (D120).
import type { Db } from "../db";
import {
  archivedCalls,
  archivedCount,
  callsOfWeeks,
  newestMarks,
  teamCalls,
  teamsOf,
  type RollCallRow,
} from "../repo/roll-call";
import { endOfDayReads } from "../repo/workspace-rosters";
import type { WorkspaceAccess } from "./access";
import { calendarDays } from "./calendar";
import type { Placed } from "./calendar-model";
import { addDays } from "./calendar-time";
import { awayOn, type AwayNote, type MemberFacts } from "./fact-fields";
import { factsOf } from "./member-facts";
import { WEEK_READS, weekQuestPoints } from "./member-week";
import { clockAt } from "./members-list";
import { openOccasion, rosterOf, type Occasion, type Opened } from "./roll-call";
import {
  callOrder,
  FROM_CALENDAR,
  tally,
  teamOrder,
  type Mark,
  type RollKind,
  type Tally,
} from "./roll-call-rules";

type Member = { uid: number; name: string; rankCode: number | null };

export interface CallRow extends Member {
  mark: Mark | null;
  version: number;
  /** Left out that day; `until` is the away note's last day (null: On a break). */
  away: { until: string | null } | null;
  /** The member's away note and its version, for the away dates sheet. */
  note: AwayNote | null;
  noteVersion: number;
}

/** The members asked, each with their away state that day. */
function asked(members: Member[], facts: Map<number, MemberFacts>, day: string, zone: string) {
  return members.map((m) => ({ ...m, away: awayOn(facts.get(m.uid), day, zone) }));
}

/** A team's members by the roster's current names; one who left keeps the name they had when picked. */
function teamMembers(team: { uid: number; name: string }[], roster: Member[]): Member[] {
  const byUid = new Map(roster.map((m) => [m.uid, m]));
  return team.map((t) => byUid.get(t.uid) ?? { uid: t.uid, name: t.name, rankCode: null });
}

export interface WeekItem {
  key: string;
  occasion: Occasion;
  kind: RollKind;
  variant: string | null;
  day: string;
  placed: Placed | null;
  /** Null before anyone marked or picked. */
  callId: number | null;
  tally: Tally;
  /** An Elixir Scramble team's size. */
  team: number | null;
}

/** Each roll call's counts, from its marks and (Elixir Scramble) its team, away members left out. */
async function counter(db: Db, access: WorkspaceAccess, calls: RollCallRow[], zone: string) {
  const ids = calls.map((c) => c.id);
  const [roster, facts, marks, teams] = await Promise.all([
    rosterOf(db, access),
    factsOf(db, access),
    newestMarks(db, ids),
    teamsOf(db, ids),
  ]);
  return (callId: number | null, kind: RollKind, day: string) => {
    const team = teams.filter((t) => t.rollCallId === callId);
    const members = kind === "elixir" ? teamMembers(team, roster) : roster;
    const own = new Map(
      marks.filter((m) => m.rollCallId === callId).map((m) => [m.uid, m.mark as Mark | null]),
    );
    const size = kind === "elixir" ? team.length : null;
    return { callId, tally: tally(asked(members, facts, day, zone), own), team: size };
  };
}

/**
 * The week's occasions from Monday `monday`: the Calendar's (KvK, Undead Siege, Cheese Trap, Elixir) and
 * those added. A Calendar roll call whose week was skipped or moved out, or whose entry was deleted, shows with the added
 * ones, on its own day, with its marks. An archived roll call is left out, a Calendar one with it (D120).
 * `zone` is the server's (SERVER_TZ).
 */
export async function weekItems(db: Db, access: WorkspaceAccess, monday: string, zone: string) {
  const placed = (await calendarDays(db, access, monday, addDays(monday, 6))).filter(
    (p) => FROM_CALENDAR[p.entry.kind] !== undefined,
  );
  const weeks = [...new Set([monday, ...placed.map((p) => p.week)])];
  const calls = await callsOfWeeks(db, access.workspaceId, weeks);
  const counted = await counter(db, access, calls, zone);
  const matched = new Set<number>();
  const linked = placed.flatMap((p): WeekItem[] => {
    const kind = FROM_CALENDAR[p.entry.kind] as RollKind;
    const call = calls.find((c) => c.entryId === p.entry.id && c.week === p.week);
    if (call) matched.add(call.id);
    if (call?.archivedAt) return [];
    const item: WeekItem = {
      key: `${p.entry.id}:${p.week}`,
      occasion: { entry: p.entry.id, week: p.week },
      kind,
      variant: p.entry.variant,
      day: p.day,
      placed: p,
      ...counted(call?.id ?? null, kind, p.day),
    };
    return [item];
  });
  const added = calls
    .filter((c) => !matched.has(c.id) && !c.archivedAt)
    .filter((c) => c.day >= monday && c.day <= addDays(monday, 6))
    .map((c) => byId(c, counted));
  return [...linked, ...added].sort(
    (a, b) => a.day.localeCompare(b.day) || (a.placed?.minute ?? -1) - (b.placed?.minute ?? -1),
  );
}

/** A roll call by its id, on its own day, without its Calendar entry's time. */
const byId = (c: RollCallRow, counted: Awaited<ReturnType<typeof counter>>): WeekItem => ({
  key: `rc:${c.id}`,
  occasion: { id: c.id },
  kind: c.kind as RollKind,
  variant: c.variant,
  day: c.day,
  placed: null,
  ...counted(c.id, c.kind as RollKind, c.day),
});

/** The archived roll calls (D120), the newest day first, each with its counts. */
export async function archivedItems(db: Db, access: WorkspaceAccess, zone: string) {
  const calls = await archivedCalls(db, access.workspaceId);
  const counted = await counter(db, access, calls, zone);
  return calls.map((c) => byId(c, counted));
}

/** How many roll calls of the week from Monday `monday` are archived: the week's hint to Archived (D120). */
export function archivedInWeek(db: Db, access: WorkspaceAccess, monday: string) {
  return archivedCount(db, access.workspaceId, monday, addDays(monday, 6));
}

export interface CallView {
  opened: Opened;
  rows: CallRow[];
  tally: Tally;
  /** An Elixir Scramble team's size; null for other kinds. */
  team: number | null;
  /** The roster and member facts read for it, so Raid prep's part of the same page reads them once. */
  loaded: Loaded;
}

export interface Loaded {
  roster: Awaited<ReturnType<typeof rosterOf>>;
  facts: Map<number, MemberFacts>;
}

/** One roll call's rows, in the order they keep while marking (callOrder). */
export async function callView(
  db: Db,
  access: WorkspaceAccess,
  occasion: Occasion,
  language: string,
  zone: string,
): Promise<CallView | null> {
  const opened = await openOccasion(db, access, occasion);
  if (!opened) return null;
  const ids = opened.call ? [opened.call.id] : [];
  const [roster, facts, marks, team] = await Promise.all([
    rosterOf(db, access),
    factsOf(db, access),
    newestMarks(db, ids),
    teamsOf(db, ids),
  ]);
  const members = opened.kind === "elixir" ? teamMembers(team, roster) : roster;
  const byUid = new Map(marks.map((m) => [m.uid, m]));
  const own = new Map(marks.map((m) => [m.uid, m.mark as Mark | null]));
  const rows = callOrder(asked(members, facts, opened.day, zone), own, language).map((m) => ({
    ...m,
    mark: own.get(m.uid) ?? null,
    version: byUid.get(m.uid)?.version ?? 0,
    note: facts.get(m.uid)?.away?.value ?? null,
    noteVersion: facts.get(m.uid)?.away?.version ?? 0,
  }));
  return {
    opened,
    rows,
    tally: tally(rows, own),
    team: opened.kind === "elixir" ? team.length : null,
    loaded: { roster, facts },
  };
}

export interface TeamRow {
  uid: number;
  name: string;
  picked: boolean;
  /** The other team that week holds them ("A" or "B"). */
  other: string | null;
  /** Their clock's minute when the window starts; null with no time zone. */
  theirMinute: number | null;
  activeThisWeek: boolean;
  squad: number | null;
  /** Away on the team's day (D103's rule): only a picked member can be, the suggestions leave them out. */
  away: boolean;
}

/**
 * An Elixir Scramble team: its members first, each flagged when away that day (issue 585), then everyone
 * else not away that day, suggested first.
 */
export async function teamView(
  db: Db,
  access: WorkspaceAccess,
  occasion: Occasion,
  language: string,
  serverZone: string,
) {
  const opened = await openOccasion(db, access, occasion);
  if (!opened?.placed || opened.kind !== "elixir") return null;
  const [roster, facts, reads, elixir] = await Promise.all([
    rosterOf(db, access),
    factsOf(db, access),
    endOfDayReads(db, access.unionId, WEEK_READS),
    teamCalls(db, access.workspaceId, opened.week),
  ]);
  // A roll call whose Calendar entry was deleted is not a team any more (as in setTeam, D123).
  const teams = await teamsOf(
    db,
    elixir.map((c) => c.id),
  );
  const variantOf = new Map(elixir.map((c) => [c.id, c.variant]));
  const mine = teams.filter((t) => t.rollCallId === opened.call?.id);
  const other = new Map(
    teams.filter((t) => t.rollCallId !== opened.call?.id).map((t) => [t.uid, t.rollCallId]),
  );
  const clock = clockAt(opened.day, serverZone);
  const hour = Math.floor((opened.placed.minute ?? 0) / 60);
  const row = (m: Member, picked: boolean) => {
    const f = facts.get(m.uid);
    const zone = f?.timeZone?.value ?? null;
    const otherCall = other.get(m.uid);
    return {
      uid: m.uid,
      name: m.name,
      picked,
      other: otherCall === undefined ? null : (variantOf.get(otherCall) ?? null),
      theirMinute: zone === null ? null : clock(zone, hour),
      active: weekQuestPoints(reads, m.uid),
      squad: f?.squadMight?.value ?? null,
      away: awayOn(f, opened.day, serverZone) !== null,
    };
  };
  const pickedUids = new Set(mine.map((t) => t.uid));
  const free = asked(roster, facts, opened.day, serverZone).filter((m) => !pickedUids.has(m.uid));
  // The other team's members go last: they cannot be picked, so the suggestions read first.
  const open = teamOrder(
    free.filter((m) => m.away === null).map((m) => row(m, false)),
    language,
  );
  const ordered = [
    ...teamMembers(mine, roster).map((m) => row(m, true)),
    ...open.filter((r) => r.other === null),
    ...open.filter((r) => r.other !== null),
  ];
  const rows: TeamRow[] = ordered.map(({ active: a, ...r }) => ({
    ...r,
    activeThisWeek: (a ?? 0) > 0,
  }));
  return { opened, rows, picked: mine.length, away: free.filter((m) => m.away).length };
}
