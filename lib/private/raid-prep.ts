// Raid prep (issue 474, D137): the Raid Shield roll call's second mark and the tracker's shield readings,
// inside one workspace (D71). Each member gets two marks: Shield (the roll call's own, the tracker's
// suggestion confirmed by an officer) and Squads off the wall (`part` `wall`, marked after scouting: the
// API cannot say where squads are). The readings are the Raid Shield check's two reads of the alliance's
// own members (`player_reads`, D132), only while `shield_check` is on (D134). They are attack-relevant:
// nothing here is logged, cached or sent anywhere but this workspace's pages. People first (D75): "not
// seen yet" is a hint; the tracker's marks (lib/raid-prep-fill.ts) are ✓, and ✗ only from the morning
// check, a dated reading the owner approved (D137, 2026-11-21), and never over an officer's mark. Each row
// shows the night and morning checkpoints that happened. A seen shield's length is never shown:
// `shield_type` 0 was seen for an 8 h and a 24 h shield (D137, 2026-11-21).
import type { Db } from "../db";
import { fridayOf, trackerMarks } from "../raid-prep-fill";
import { checkTrackerMarks, newestMarks, type MarkRow } from "../repo/roll-call";
import {
  getShieldCheck,
  shieldReadings,
  shieldSettingsOf,
  type ShieldCheckRow,
  type StoredReading,
} from "../repo/shield-checks";
import {
  morningMinuteOf,
  passWindows,
  raidOf,
  suggestionOf,
  type ShieldSuggestion,
} from "../shield-check";
import type { WorkspaceAccess } from "./access";
import { awayOn, type MemberFacts } from "./fact-fields";
import { featureOn } from "./features";
import { factsOf } from "./member-facts";
import { messageLanguage } from "./ready-message";
import {
  ensureCall,
  openOccasion,
  rosterOf,
  type Occasion,
  type Opened,
  type Written,
} from "./roll-call";
import type { Loaded } from "./roll-call-view";

export { fridayOf };

/** The languages Raid prep's message is written in; any other is English. */
export type MessageLanguage = "en" | "pt-BR" | "fr";

/** One of the tracker's two checkpoints of a member (D137, 2026-11-21): its map scan's time (epoch ms). */
export interface Checkpoint {
  pass: "night" | "morning";
  at: number;
  on: boolean;
}

export interface TrackerHint {
  suggestion: ShieldSuggestion;
  /** The night check, then the morning check: only those that happened, each with its map scan's time. */
  checkpoints: Checkpoint[];
}

export interface PrepRow {
  tracker: TrackerHint | null;
  wall: { mark: string | null; version: number };
  /**
   * The Shield mark is the tick's, from the tracker's reading (D137, 2026-11-21); `unchecked` while no
   * officer pressed "Checked" since it was written or tapped the row.
   */
  fromTracker: { unchecked: boolean } | null;
  /** The member's language for the message: their recorded one, else the game's, else English. */
  language: MessageLanguage;
}

export interface ReadCount {
  read: number;
  on: number;
  /** The newest answer of that read (epoch ms). */
  at: number | null;
}

export interface PrepView {
  friday: string;
  /** False while the Raid Shield check is off: no reading is shown. */
  tracker: boolean;
  morningMinute: number;
  night: ReadCount | null;
  morning: ReadCount | null;
  members: number;
  /** "before the reset" until Saturday 00:00 ST, then "before KvK". */
  when: "reset" | "kvk";
  /** KvK has not started yet: the checks still to come can be named (issue 585, first glance). */
  ahead: boolean;
  rows: Map<number, PrepRow>;
  /** The newest unchecked tracker mark's time (epoch ms): the notice's "reading at" and Checked's `seen`. */
  toCheckAt: number | null;
  /** The check's Discord summary (D137, D147, issue 585); null while the check is off. */
  summary: SummaryState | null;
}

/**
 * What the check's own row records first, for any week: posted (last posted or edited at `at`) or gone
 * (Discord said it was deleted, so it is not posted again for this check, D137). Then, only for the check
 * still ahead of KvK (a past week has no state to infer, review of PR 590): off (the switch is off), unset
 * (no Raid Shield channel can take it, D147), waiting (no reading yet, or one so new that its tick is still
 * posting) or failed (a reading older than a tick and nothing posted). A past week with nothing recorded
 * shows nothing.
 */
export type SummaryState =
  { state: "posted"; at: number } | { state: "off" | "unset" | "waiting" | "failed" | "gone" };

/** A read and its summary share one tick (at most 180 s, D137): past this, a reading with no post failed. */
const POST_WITHIN_MS = 5 * 60_000;

/** The newest answer of either read (epoch ms), null before any. */
const newestOf = (reads: { night: ReadCount | null; morning: ReadCount | null }) =>
  reads.morning?.at ?? reads.night?.at ?? null;

export function summaryOf(
  check: Pick<ShieldCheckRow, "messageId" | "messageHash" | "postedAt"> | null,
  on: { discord: boolean; channel: boolean; current: boolean },
  reads: { night: ReadCount | null; morning: ReadCount | null },
  now: number,
): SummaryState | null {
  if (check?.messageHash === "gone") return { state: "gone" };
  if (check?.messageId && check.postedAt) return { state: "posted", at: check.postedAt.getTime() };
  if (!on.current) return null;
  if (!on.discord) return { state: "off" };
  if (!on.channel) return { state: "unset" };
  const newest = newestOf(reads);
  return newest !== null && now - newest > POST_WITHIN_MS
    ? { state: "failed" }
    : { state: "waiting" };
}

/** The officers' recorded languages first, then the game's from either read, else English. */
const languageOf = (facts: MemberFacts | undefined, game: (string | null)[]): MessageLanguage =>
  messageLanguage([...(facts?.languages?.value ?? []), ...game]) ?? "en";

/** A checkpoint from a reading that said something; a missing field is no checkpoint (D75). */
const checkpointOf = (pass: Checkpoint["pass"], r: StoredReading | null): Checkpoint[] =>
  r && suggestionOf(r) !== "unknown"
    ? [{ pass, at: (r.mapAt ?? r.readAt).getTime(), on: suggestionOf(r) === "on" }]
    : [];

function hintOf(night: StoredReading | null, morning: StoredReading | null): TrackerHint {
  return {
    suggestion: suggestionOf(morning ?? night),
    checkpoints: [...checkpointOf("night", night), ...checkpointOf("morning", morning)],
  };
}

const countOf = (uids: Set<number>, readings: StoredReading[]): ReadCount | null => {
  const mine = readings.filter((r) => uids.has(r.uid) && suggestionOf(r) !== "unknown");
  if (mine.length === 0) return null;
  return {
    read: mine.length,
    on: mine.filter((r) => suggestionOf(r) === "on").length,
    at: Math.max(...mine.map((r) => r.readAt.getTime())),
  };
};

/**
 * Whether the tick's ✓ is still to check: written after the last "Checked" (`checkedAt`), and no wall
 * tap on the row since (an officer's tap on the row counts as checking it).
 */
const unchecked = (main: MarkRow, wall: MarkRow | undefined, checkedAt: Date | null) =>
  // A tracker mark "Accept the tracker's" wrote was checked by the officer who pressed it.
  !main.officer && (checkedAt === null || main.at > checkedAt) && !(wall && wall.at > main.at);

/** The row's Shield mark when the tick wrote it, and whether it is still to check. */
const fromTrackerOf = (marks: {
  main: MarkRow | undefined;
  wall: MarkRow | undefined;
  checkedAt: Date | null;
}) =>
  marks.main?.tracker && marks.main.mark !== null
    ? { unchecked: unchecked(marks.main, marks.wall, marks.checkedAt) }
    : null;

/** One member's row: the tracker's hint (null while the check is off), the wall mark, the tick's ✓. */
function prepRow(
  read: { night: StoredReading | null; morning: StoredReading | null },
  marks: { main: MarkRow | undefined; wall: MarkRow | undefined; checkedAt: Date | null },
  facts: MemberFacts | undefined,
  tracker: boolean,
): PrepRow {
  const seen = read.morning ?? read.night;
  const { wall } = marks;
  return {
    tracker: tracker && seen ? hintOf(read.night, read.morning) : null,
    wall: { mark: wall?.mark ?? null, version: wall?.version ?? 0 },
    fromTracker: fromTrackerOf(marks),
    language: languageOf(facts, [read.morning?.language ?? null, read.night?.language ?? null]),
  };
}

/** Both reads of the check of Friday `friday`, each member's newest in its window. */
async function readingsOf(db: Db, access: WorkspaceAccess, friday: string, zone: string) {
  const w = passWindows(friday, { SERVER_TZ: zone });
  const [night, morning] = await Promise.all([
    shieldReadings(db, access.unionId, w.night.from, w.night.to),
    shieldReadings(db, access.unionId, w.morning.from, w.morning.to),
  ]);
  return { night, morning };
}

/**
 * Raid prep's part of a Raid Shield roll call's page: the tracker's hints, the wall marks, the counts and
 * the Discord summary's state. `shieldChannel`: a Raid Shield channel the summary can post to is saved.
 * `loaded`: the roster, facts and Shield marks the page's `callRead` already read; read here when not given.
 */
export async function prepView(
  db: Db,
  access: WorkspaceAccess,
  opened: Opened,
  clock: { zone: string; now: Date; shieldChannel?: boolean },
  loaded?: Loaded,
): Promise<PrepView> {
  // The same raid as a member's own page counts from (`raidOf`).
  const { friday, reset, kvk: kvkAt } = raidOf(opened.day, { SERVER_TZ: clock.zone });
  const tracker = featureOn(access, "shield_check");
  const ids = opened.call ? [opened.call.id] : [];
  const [{ roster, facts, marks: main }, wall, settings, reads, check] = await Promise.all([
    loaded ??
      Promise.all([rosterOf(db, access), factsOf(db, access), newestMarks(db, ids)]).then(
        ([r, f, m]) => ({ roster: r, facts: f, marks: m }),
      ),
    newestMarks(db, ids, "wall"),
    shieldSettingsOf(db, access.workspaceId),
    tracker
      ? readingsOf(db, access, friday, clock.zone)
      : Promise.resolve({ night: [], morning: [] }),
    getShieldCheck(db, { day: friday, unionId: access.unionId }),
  ]);
  const nightOf = new Map(reads.night.map((r) => [r.uid, r]));
  const morningOf = new Map(reads.morning.map((r) => [r.uid, r]));
  const mainOf = new Map(main.map((m) => [m.uid, m]));
  const wallOf = new Map(wall.map((m) => [m.uid, m]));
  const checkedAt = opened.call?.trackerCheckedAt ?? null;
  const rows = new Map(
    roster.map((m) => {
      const read = { night: nightOf.get(m.uid) ?? null, morning: morningOf.get(m.uid) ?? null };
      const marks = { main: mainOf.get(m.uid), wall: wallOf.get(m.uid), checkedAt };
      return [m.uid, prepRow(read, marks, facts.get(m.uid), tracker)];
    }),
  );
  const toCheck = [...rows]
    // The page lists away members apart, so their marks are not counted here either.
    .filter(
      ([uid, r]) => r.fromTracker?.unchecked && !awayOn(facts.get(uid), opened.day, clock.zone),
    )
    .map(([uid]) => mainOf.get(uid)?.at.getTime() ?? 0);
  const uids = new Set(roster.map((m) => m.uid));
  const counts = { night: countOf(uids, reads.night), morning: countOf(uids, reads.morning) };
  // Only the check still ahead of KvK has a state to infer from today's settings (review of PR 590).
  const current = clock.now.getTime() < kvkAt.getTime();
  const on = { discord: !!settings?.discord, channel: !!clock.shieldChannel, current };
  return {
    friday,
    tracker,
    morningMinute: morningMinuteOf(settings?.morningMinute),
    ...counts,
    members: roster.length,
    when: clock.now.getTime() < reset.getTime() ? "reset" : "kvk",
    ahead: current,
    rows,
    toCheckAt: toCheck.length > 0 ? Math.max(...toCheck) : null,
    summary: tracker ? summaryOf(check, on, counts, clock.now.getTime()) : null,
  };
}

/**
 * "Accept the tracker's": every member in `uids` whom the newest reading saw shielded, not away that day
 * and with no Shield mark yet, gets ✓ Shield up as the tracker's mark, on the officer's name
 * (lib/raid-prep-fill.ts, the tick's fill's code path): the morning check still updates it. "Not seen yet" and "no reading" stay not set: a hint is never a ✗ (D75). A member
 * someone marked meanwhile keeps that mark.
 */
export async function acceptTracker(
  db: Db,
  access: WorkspaceAccess,
  input: { occasion: Occasion; uids: number[] },
  clock: { now: Date; zone: string },
): Promise<Written | { ok: false; code: "not_found" | "invalid" }> {
  if (!featureOn(access, "shield_check")) return { ok: false, code: "invalid" };
  const o = await openOccasion(db, access, input.occasion);
  if (!o) return { ok: false, code: "not_found" };
  if (o.kind !== "shield") return { ok: false, code: "invalid" };
  const call = await ensureCall(db, access, o);
  const fill = { uids: input.uids, now: clock.now, zone: clock.zone, by: access.user.id };
  const written = await trackerMarks(db, access, { id: call.id, day: o.day }, fill);
  return { ok: true, mark: "yes", written };
}

/**
 * "Checked" (D137, 2026-11-21): the tick's marks up to `seen` (the newest the officer's page showed) are
 * checked, and the notice goes. Only on a Raid prep roll call of this workspace.
 */
export async function checkTracker(
  db: Db,
  access: WorkspaceAccess,
  input: { occasion: Occasion; seen: number },
  now: Date,
): Promise<{ ok: true } | { ok: false; code: "not_found" | "invalid" }> {
  const o = await openOccasion(db, access, input.occasion);
  if (!o?.call) return { ok: false, code: "not_found" };
  if (o.kind !== "shield") return { ok: false, code: "invalid" };
  // Never past now: a `seen` from the future would hide every later fill's notice (D75: never silent).
  const seen = new Date(Math.min(input.seen, now.getTime()));
  const done = await checkTrackerMarks(db, access.workspaceId, o.call.id, seen);
  return done ? { ok: true } : { ok: false, code: "not_found" };
}
