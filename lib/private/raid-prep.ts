// Raid prep (issue 474, D137): the Raid Shield roll call's second mark and the tracker's shield readings,
// inside one workspace (D71). Each member gets two marks: Shield (the roll call's own, the tracker's
// suggestion confirmed by an officer) and Squads off the wall (`part` `wall`, marked after scouting: the
// API cannot say where squads are). The readings are the Raid Shield check's two reads of the alliance's
// own members (`player_reads`, D132), only while `shield_check` is on (D134). They are attack-relevant:
// nothing here is logged, cached or sent anywhere but this workspace's pages. People first (D75): "not
// seen yet" and "may end before KvK" are hints, never a ✗, and "Accept the tracker's" writes only ✓.
import type { Db } from "../db";
import { insertMarks, newestMarks, type MarkRow } from "../repo/roll-call";
import { shieldReadings, shieldSettingsOf, type StoredReading } from "../repo/shield-checks";
import {
  kvkStart,
  mayEndBeforeKvk,
  morningMinuteOf,
  passWindows,
  shieldEndsBy,
  suggestionOf,
  type ShieldSuggestion,
} from "../shield-check";
import type { WorkspaceAccess } from "./access";
import { addDays, mondayOf } from "./calendar-time";
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

/** The Friday whose night the roll call of `day` prepares: that week's (Monday + 4). */
export const fridayOf = (day: string) => addDays(mondayOf(day), 4);

/** The languages Raid prep's message is written in; any other is English. */
export type MessageLanguage = "en" | "pt-BR" | "fr";

export interface TrackerHint {
  suggestion: ShieldSuggestion;
  /** The map scan's time of the newest reading (epoch ms), shown on every row. */
  mapAt: number | null;
  /** The 8-hour shield's latest end; null for other kinds. */
  endsBy: number | null;
  mayEndBeforeKvk: boolean;
  /** Seen on Friday night, not seen by the morning read: the two map scan times. */
  lost: { night: number; morning: number } | null;
}

export interface PrepRow {
  tracker: TrackerHint | null;
  wall: { mark: string | null; version: number };
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
  rows: Map<number, PrepRow>;
}

const ms = (d: Date | null) => (d ? d.getTime() : null);

/** The officers' recorded languages first, then the game's from either read, else English. */
const languageOf = (facts: MemberFacts | undefined, game: (string | null)[]): MessageLanguage =>
  messageLanguage([...(facts?.languages?.value ?? []), ...game]) ?? "en";

function hintOf(
  night: StoredReading | null,
  morning: StoredReading | null,
  kvkAt: Date,
): TrackerHint {
  const newest = morning ?? night;
  const lost =
    night && morning && suggestionOf(night) === "on" && suggestionOf(morning) === "not_seen"
      ? {
          night: ms(night.mapAt ?? night.readAt) as number,
          morning: ms(morning.mapAt ?? morning.readAt) as number,
        }
      : null;
  return {
    suggestion: suggestionOf(newest),
    mapAt: ms(newest?.mapAt ?? null),
    endsBy: ms(shieldEndsBy(newest)),
    mayEndBeforeKvk: mayEndBeforeKvk(newest, kvkAt),
    lost,
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

/** One member's row: the tracker's hint (null while the check is off: `kvkAt` null), the wall mark. */
function prepRow(
  read: { night: StoredReading | null; morning: StoredReading | null },
  wall: MarkRow | undefined,
  facts: MemberFacts | undefined,
  kvkAt: Date | null,
): PrepRow {
  const seen = read.morning ?? read.night;
  return {
    tracker: kvkAt && seen ? hintOf(read.night, read.morning, kvkAt) : null,
    wall: { mark: wall?.mark ?? null, version: wall?.version ?? 0 },
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

/** Raid prep's part of a Raid Shield roll call's page: the tracker's hints, the wall marks, the counts. */
export async function prepView(
  db: Db,
  access: WorkspaceAccess,
  opened: Opened,
  clock: { zone: string; now: Date },
): Promise<PrepView> {
  const friday = fridayOf(opened.day);
  const tracker = featureOn(access, "shield_check");
  const [roster, facts, wall, settings, reads] = await Promise.all([
    rosterOf(db, access),
    factsOf(db, access),
    opened.call ? newestMarks(db, [opened.call.id], "wall") : Promise.resolve([] as MarkRow[]),
    shieldSettingsOf(db, access.workspaceId),
    tracker
      ? readingsOf(db, access, friday, clock.zone)
      : Promise.resolve({ night: [], morning: [] }),
  ]);
  const kvkAt = kvkStart(friday, { SERVER_TZ: clock.zone });
  const nightOf = new Map(reads.night.map((r) => [r.uid, r]));
  const morningOf = new Map(reads.morning.map((r) => [r.uid, r]));
  const wallOf = new Map(wall.map((m) => [m.uid, m]));
  const rows = new Map(
    roster.map((m) => {
      const read = { night: nightOf.get(m.uid) ?? null, morning: morningOf.get(m.uid) ?? null };
      return [m.uid, prepRow(read, wallOf.get(m.uid), facts.get(m.uid), tracker ? kvkAt : null)];
    }),
  );
  const uids = new Set(roster.map((m) => m.uid));
  const reset = kvkAt.getTime() - 12 * 3_600_000;
  return {
    friday,
    tracker,
    morningMinute: morningMinuteOf(settings?.morningMinute),
    night: countOf(uids, reads.night),
    morning: countOf(uids, reads.morning),
    members: roster.length,
    when: clock.now.getTime() < reset ? "reset" : "kvk",
    rows,
  };
}

/**
 * "Accept the tracker's": every member in `uids` whom the newest reading saw shielded, not away that day
 * and with no Shield mark yet, gets ✓ Shield up. "Not seen yet" and "no reading" stay not set: a hint is
 * never a ✗ (D75). A member someone marked meanwhile keeps that mark.
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
  const [roster, facts, reads] = await Promise.all([
    rosterOf(db, access),
    factsOf(db, access),
    readingsOf(db, access, fridayOf(o.day), clock.zone),
  ]);
  const newest = new Map([...reads.night, ...reads.morning].map((r) => [r.uid, r]));
  const asked = new Set(roster.map((m) => m.uid));
  const call = await ensureCall(db, access, o);
  const marks = new Map((await newestMarks(db, [call.id])).map((m) => [m.uid, m]));
  const rows = [...new Set(input.uids)]
    .filter((uid) => asked.has(uid) && awayOn(facts.get(uid), o.day, clock.zone) === null)
    .filter((uid) => suggestionOf(newest.get(uid) ?? null) === "on")
    .filter((uid) => (marks.get(uid)?.mark ?? null) === null)
    .map((uid) => ({
      rollCallId: call.id,
      uid,
      part: "main" as const,
      version: (marks.get(uid)?.version ?? 0) + 1,
      mark: "yes",
      writtenBy: access.user.id,
      writtenAt: clock.now,
    }));
  return { ok: true, mark: "yes", written: await insertMarks(db, rows) };
}
