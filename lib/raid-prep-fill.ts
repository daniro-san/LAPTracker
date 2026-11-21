// Raid prep's marks from the tracker (D137, amendments 2026-11-21). One module for "Accept the tracker's"
// (an officer's press, lib/private/raid-prep.ts) and the tick's fill after each reading (lib/shield-tick.ts).
// Outside lib/private because the tick runs it (D71's fence); both callers pass one workspace and its own
// alliance. The tick writes the tracker's two checkpoints as new versions of each member's Shield mark
// (`by_tracker`), for an officer to check:
// - the night check (Friday's reading): ✓ Shield up for each member seen with a shield; the rest stay not set;
// - the morning check (Saturday's reading): ✓ for each member still seen with a shield, ✗ "No shield seen"
//   for each member seen with none. The owner approved this one ✗ from the tracker on 2026-11-21: a dated
//   reading that tells officers whom to remind before KvK, never a judgment (D75).
// An officer's mark always wins: once an officer tapped a member's ✓ / ✗ (or "the rest", its undo), the
// tracker writes nothing for them. "Accept the tracker's" only applies the tracker's reading, so its ✓ is
// the tracker's too (`by_tracker`, on the officer's name) and the morning check still updates it. Away
// members and members with no reading get nothing. Nothing is ever deleted or cleared.
import { layOut } from "./calendar-layout";
import { addDays, mondayOf } from "./calendar-time";
import type { Db } from "./db";
import { awayOn, type AwayFacts } from "./member-away";
import { calendarRows } from "./repo/calendar";
import { latestFacts } from "./repo/member-facts";
import {
  callsOfWeeks,
  findAdded,
  findCall,
  insertCall,
  insertMarks,
  newestMarks,
  type MarkRow,
} from "./repo/roll-call";
import { shieldReadings, type StoredReading } from "./repo/shield-checks";
import { anyRoster } from "./repo/workspace-any-roster";
import { passWindows, suggestionOf } from "./shield-check";

/** One workspace and its own alliance (D71): its roll calls, facts and members only. */
export interface FillScope {
  workspaceId: number;
  unionId: number;
}

/** The Friday whose night the roll call of `day` prepares: that week's (Monday + 4). */
export const fridayOf = (day: string) => addDays(mondayOf(day), 4);

/** Each member's away note and On a break, as the roll call reads them (D103). */
async function awayFacts(db: Db, workspaceId: number): Promise<Map<number, AwayFacts>> {
  const facts = new Map<number, AwayFacts>();
  for (const r of await latestFacts(db, workspaceId)) {
    if (r.field !== "away" && r.field !== "status") continue;
    const own = facts.get(r.uid) ?? {};
    own[r.field] = { value: r.value as never, at: r.writtenAt.toISOString() };
    facts.set(r.uid, own);
  }
  return facts;
}

type Read = StoredReading | undefined;

/** Each member's newest reading of the check of Friday `friday`, in each of its two windows. */
async function readingsOf(db: Db, unionId: number, friday: string, zone: string) {
  const w = passWindows(friday, { SERVER_TZ: zone });
  const [night, morning] = await Promise.all([
    shieldReadings(db, unionId, w.night.from, w.night.to),
    shieldReadings(db, unionId, w.morning.from, w.morning.to),
  ]);
  return {
    night: new Map(night.map((r) => [r.uid, r])),
    morning: new Map(morning.map((r) => [r.uid, r])),
  };
}

/**
 * What the tick writes for one member, or null. An officer's mark wins (`m` not the tracker's). Once the
 * member has a morning reading, the morning check: ✓ or ✗, once (a mark written after that reading is it).
 * Before it, the night check: ✓ when seen with a shield and nothing marked yet.
 */
function tickMark(m: MarkRow | undefined, night: Read, morning: Read): "yes" | "no" | null {
  if (m && !m.tracker) return null;
  const late = morning ? suggestionOf(morning) : "unknown";
  if (morning && late !== "unknown") {
    if (m && m.at >= morning.readAt) return null;
    return late === "on" ? "yes" : "no";
  }
  return !m && night && suggestionOf(night) === "on" ? "yes" : null;
}

/**
 * "Accept the tracker's": ✓ for each member the newest reading (Saturday's, else Friday's) saw with a
 * shield and with no Shield mark set. Never ✗.
 */
const acceptMark = (m: MarkRow | undefined, night: Read, morning: Read): "yes" | null => {
  const newest = morning ?? night;
  return newest && suggestionOf(newest) === "on" && (m?.mark ?? null) === null ? "yes" : null;
};

export interface FillInput {
  /** Accept: the members the officer's page offered; the tick: everyone (null). */
  uids: readonly number[] | null;
  now: Date;
  zone: string;
  /** The officer who pressed Accept; null: the tick. Either way the marks are the tracker's. */
  by: number | null;
}

/** The marks to write in roll call `callId` (null: not made yet) on `day`, each the member's next version. */
async function picks(
  db: Db,
  scope: FillScope,
  at: { callId: number | null; day: string },
  input: FillInput,
) {
  const [roster, facts, reads, marks] = await Promise.all([
    anyRoster(db, scope.unionId),
    awayFacts(db, scope.workspaceId),
    readingsOf(db, scope.unionId, fridayOf(at.day), input.zone),
    at.callId === null ? Promise.resolve([]) : newestMarks(db, [at.callId]),
  ]);
  const members = new Set((roster?.members ?? []).map((m) => m.uid));
  const newest = new Map(marks.map((m) => [m.uid, m]));
  // Both write the tracker's marks: Accept only applies its reading, on the officer's name (D137).
  const rule = input.by === null ? tickMark : acceptMark;
  return [...new Set(input.uids ?? members)]
    .filter((uid) => members.has(uid) && awayOn(facts.get(uid), at.day, input.zone) === null)
    .flatMap((uid) => {
      const m = newest.get(uid);
      const mark = rule(m, reads.night.get(uid), reads.morning.get(uid));
      if (mark === null) return [];
      const version = (m?.version ?? 0) + 1;
      const by = { writtenBy: input.by, writtenAt: input.now, byTracker: true };
      return [{ uid, part: "main" as const, version, mark, ...by }];
    });
}

/** "Accept the tracker's" in a roll call: the marks stored (a version someone took meanwhile is skipped). */
export async function trackerMarks(
  db: Db,
  scope: FillScope,
  call: { id: number; day: string },
  input: FillInput,
) {
  const rows = await picks(db, scope, { callId: call.id, day: call.day }, input);
  return insertMarks(
    db,
    rows.map((r) => ({ ...r, rollCallId: call.id })),
  );
}

/** The request id of the Raid prep the tick adds for the week of Saturday `saturday` (one per week). */
const fillRequest = (saturday: string) => `tracker-fill:${saturday}`;

/**
 * The week's Raid prep for the check of Friday `friday`: a live `shield` roll call of that week (the first
 * by day; a KvK Calendar entry's moved in from another plan week too), else the week's KvK Calendar entry
 * (its row made as on a first mark), else one added as "Add a roll call" adds it, on Saturday, with the
 * tick's request id: one per kind and day (D103), and a lost race opens the winner. A deleted one keeps its
 * request id, so the tick never adds that week's again. Null when the week's Raid prep is archived: the
 * officers put it away, so nothing is filled (D120).
 */
async function weekRaidPrep(db: Db, workspaceId: number, friday: string) {
  const monday = mondayOf(friday);
  const sunday = addDays(monday, 6);
  const saturday = addDays(friday, 1);
  const cal = await calendarRows(db, workspaceId, monday, monday, sunday);
  const kvks = layOut(
    cal.entries.filter((e) => e.kind === "kvk"),
    cal.rows,
    monday,
    sunday,
  );
  const calls = await callsOfWeeks(db, workspaceId, [
    ...new Set([monday, ...kvks.map((p) => p.week)]),
  ]);
  const placedOf = (c: (typeof calls)[number]) =>
    kvks.find((p) => p.entry.id === c.entryId && p.week === c.week);
  const own = calls.find(
    (c) =>
      c.kind === "shield" &&
      (placedOf(c) !== undefined || (c.week === monday && c.day >= monday && c.day <= sunday)),
  );
  if (own?.archivedAt) return null;
  if (own) return { callId: own.id, day: placedOf(own)?.day ?? own.day, make: async () => own.id };
  const [kvk] = kvks;
  if (kvk) {
    const where = { entryId: kvk.entry.id, week: kvk.week };
    const make = async () => {
      const values = { workspaceId, kind: "shield", day: kvk.day, ...where, createdBy: null };
      await insertCall(db, values);
      return (await findCall(db, workspaceId, where))?.id ?? null;
    };
    return { callId: null, day: kvk.day, make };
  }
  const requestId = fillRequest(saturday);
  const make = async () => {
    const values = { workspaceId, kind: "shield", day: saturday, week: monday, requestId };
    const made = await insertCall(db, { ...values, createdBy: null });
    if (made !== null) return made;
    const found =
      (await findCall(db, workspaceId, { requestId })) ??
      (await findAdded(db, workspaceId, "shield", saturday));
    return found?.id ?? null;
  };
  return { callId: null, day: saturday, make };
}

/**
 * The tick's fill after a reading of the check of Friday `friday`: the week's Raid prep gets the night check
 * or the morning check of each member it is due for (`tickMark`), as the tracker's. The roll call is made
 * only when there is a mark to write. Returns how many marks were stored.
 */
export async function fillRaidPrep(
  db: Db,
  scope: FillScope,
  friday: string,
  clock: { now: Date; zone: string },
): Promise<number> {
  const prep = await weekRaidPrep(db, scope.workspaceId, friday);
  if (!prep) return 0;
  const input = { uids: null, now: clock.now, zone: clock.zone, by: null };
  const rows = await picks(db, scope, prep, input);
  if (rows.length === 0) return 0;
  const callId = prep.callId ?? (await prep.make());
  if (callId === null) return 0;
  const written = await insertMarks(
    db,
    rows.map((r) => ({ ...r, rollCallId: callId })),
  );
  return written.length;
}
