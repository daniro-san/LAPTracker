// The workspace calendar's reads and writes (issue 300, D71). Every call takes a WorkspaceAccess, so an
// entry is only ever read or changed inside its own workspace. Edits are field-level with an optimistic
// version check (owner, issue 293): a field changed since the officer looked at it is refused with its newer
// value, who changed it and when; two officers changing different fields both keep their change.
import type { Db } from "../db";
import {
  calendarRows,
  deleteEntry,
  findEntry,
  findTheme,
  insertEntry,
  lockWeekRow,
  officerNames,
  updateEntry,
  updateWeekRow,
} from "../repo/calendar";
import { latestRoster } from "../repo/workspace-rosters";
import type { FieldEdits } from "../schema";
import type { WorkspaceAccess } from "./access";
import {
  firstWeek,
  inPlan,
  layOut,
  fits,
  WEEK_FIELDS,
  type EntryRow,
  type Field,
  type FieldChange,
  type NewEntry,
  type OccurrenceRow,
  type Placed,
} from "./calendar-model";
import { addDays, isDay, mondayOf, weekdayIndex } from "./calendar-time";

/** What the days from `from` to `to` hold, laid out (whole weeks). */
export async function calendarDays(
  db: Db,
  access: WorkspaceAccess,
  from: string,
  to: string,
): Promise<Placed[]> {
  const { entries, rows } = await calendarRows(db, access.workspaceId, mondayOf(from), from, to);
  return layOut(entries, rows, from, to);
}

/** The newest roster's members, uid and name only, for the caravan picker; only the workspace's own alliance. */
export async function pickableMembers(
  db: Db,
  access: WorkspaceAccess,
): Promise<{ uid: number; name: string }[]> {
  return (await latestRoster(db, access.unionId)).map(({ uid, name }) => ({ uid, name }));
}

export async function createEntry(
  db: Db,
  access: WorkspaceAccess,
  input: NewEntry,
): Promise<{ ok: true; id: number } | { ok: false; code: "theme_exists" }> {
  const base = {
    workspaceId: access.workspaceId,
    kind: input.kind,
    notes: input.notes,
    link: input.link,
    forMembers: input.forMembers,
    createdBy: access.user.id,
  };
  if (input.kind === "duel") {
    const monday = mondayOf(input.day);
    if ((await findTheme(db, access.workspaceId, monday)) !== null) {
      return { ok: false, code: "theme_exists" };
    }
    const id = await insertEntry(db, {
      ...base,
      title: input.title,
      day: monday,
      lastWeek: monday,
    });
    return { ok: true, id };
  }
  const id = await insertEntry(db, {
    ...base,
    variant: "variant" in input ? input.variant : null,
    level: "level" in input ? input.level : null,
    title: "title" in input ? input.title : null,
    day: input.day,
    minute: input.minute,
    weekly: input.weekly,
    lastWeek: input.weekly ? null : mondayOf(input.day),
  });
  return { ok: true, id };
}

/** A field as it now stands, its version, who wrote it when, and what the refused save sent. */
export interface Conflict {
  field: Field;
  version: number;
  value: unknown;
  mine: unknown;
  by: string | null;
  at: string | null;
}

type Done =
  { ok: true } | { ok: false; code: "not_found" | "invalid" | "not_in_alliance" | "same_person" };
export type EditResult = Done | { ok: false; code: "stale"; conflicts: Conflict[] };

/** A field's current value, in the shape a change of it carries (plus the picked member's name). */
function valueOf(entry: EntryRow, row: OccurrenceRow | null, field: Field): unknown {
  switch (field) {
    case "slot":
      return { weekday: weekdayIndex(entry.day), minute: entry.minute };
    case "when":
      return row?.day ? { day: row.day, minute: row.minute } : null;
    case "coach":
      return row?.coachUid ? { uid: row.coachUid, name: row.coachName } : null;
    case "second":
      return row?.secondKind
        ? { kind: row.secondKind, uid: row.secondUid, name: row.secondName }
        : null;
    default:
      return entry[field];
  }
}

type Patch = Record<string, unknown>;

/** The columns a change writes. `names` is the roster, by uid, for the caravan's picks. */
function columnsOf(c: FieldChange, entry: EntryRow, names: Map<number, string>): Patch | null {
  switch (c.field) {
    case "slot":
      return { day: addDays(firstWeek(entry), c.value.weekday), minute: c.value.minute };
    case "when":
      return c.value ? { day: c.value.day, minute: c.value.minute } : { day: null, minute: null };
    case "coach": {
      if (!c.value) return { coachUid: null, coachName: null };
      const name = names.get(c.value.uid);
      return name === undefined ? null : { coachUid: c.value.uid, coachName: name };
    }
    case "second": {
      if (!c.value) return { secondKind: null, secondUid: null, secondName: null };
      const name = names.get(c.value.uid);
      return name === undefined
        ? null
        : { secondKind: c.value.kind, secondUid: c.value.uid, secondName: name };
    }
    default:
      return { [c.field]: c.value };
  }
}

/** A move back onto the plan's own day and time is no move. */
function normalise(c: FieldChange, entry: EntryRow, week: string): FieldChange {
  if (c.field !== "when" || c.value === null) return c;
  const planned = addDays(week, weekdayIndex(entry.day));
  return c.value.day === planned && c.value.minute === entry.minute ? { ...c, value: null } : c;
}

const versionOf = (edits: FieldEdits | undefined, field: Field) => edits?.[field]?.v ?? 0;

/**
 * Applies `changes` to the entry (and to its row for `week`, for a move or the caravan's picks), all or
 * none. Any field whose version is not the one sent comes back as a conflict, and nothing is written.
 */
export async function editEntry(
  db: Db,
  access: WorkspaceAccess,
  request: { entry: number; week: string | null; changes: FieldChange[] },
  now: Date,
): Promise<EditResult> {
  const { entry: id, week, changes } = request;
  const onWeek = changes.some((c) => WEEK_FIELDS.includes(c.field));
  const once = new Set(changes.map((c) => c.field)).size === changes.length;
  if (!once || (onWeek && (week === null || !isDay(week) || mondayOf(week) !== week))) {
    return { ok: false, code: "invalid" };
  }
  const picks = changes.some((c) => c.field === "coach" || c.field === "second");
  const names = picks
    ? new Map((await pickableMembers(db, access)).map((m) => [m.uid, m.name]))
    : new Map<number, string>();
  const result = await db.transaction(async (tx) => {
    const entry = await findEntry(tx, access.workspaceId, id, true);
    if (!entry || (onWeek && !inPlan(entry, week as string)))
      return { ok: false, code: "not_found" } as const;
    if (changes.some((c) => !fits(entry, c))) return { ok: false, code: "invalid" } as const;
    const row = onWeek ? await lockWeekRow(tx, access.workspaceId, id, week as string) : null;
    const editsOf = (f: Field) => (WEEK_FIELDS.includes(f) ? row?.edits : entry.edits);
    const stale = changes.filter((c) => versionOf(editsOf(c.field), c.field) !== c.version);
    if (stale.length > 0) {
      return { ok: false, code: "stale", stale, entry, row } as const;
    }
    return write(tx, { entry, row, week, changes, names, by: access.user.id, now });
  });
  if (result.ok || result.code !== "stale") return result;
  return { ok: false, code: "stale", conflicts: await conflicts(db, access, result, names) };
}

type Write = {
  entry: EntryRow;
  row: OccurrenceRow | null;
  week: string | null;
  changes: FieldChange[];
  names: Map<number, string>;
  by: number;
  now: Date;
};
type Split = { patch: Patch; fields: Field[] };

/** The columns each target gets and the fields they stand for; null when a picked member is unknown. */
function split(w: Write): { entry: Split; row: Split } | null {
  const out = {
    entry: { patch: {}, fields: [] } as Split,
    row: { patch: {}, fields: [] } as Split,
  };
  for (const raw of w.changes) {
    const c = normalise(raw, w.entry, w.week ?? "");
    const columns = columnsOf(c, w.entry, w.names);
    if (columns === null) return null;
    const target = out[WEEK_FIELDS.includes(c.field) ? "row" : "entry"];
    Object.assign(target.patch, columns);
    target.fields.push(c.field);
  }
  return out;
}

/** The fields' new version (the row's next rev), who wrote them and when. */
const stamp = (edits: FieldEdits, rev: number, w: Write, fields: Field[]) => ({
  ...edits,
  ...Object.fromEntries(fields.map((f) => [f, { v: rev, by: w.by, at: w.now.toISOString() }])),
});

async function write(tx: Parameters<Parameters<Db["transaction"]>[0]>[0], w: Write): Promise<Done> {
  const parts = split(w);
  if (parts === null) return { ok: false, code: "not_in_alliance" };
  const { entry, row } = parts;
  const coach = "coachUid" in row.patch ? row.patch.coachUid : w.row?.coachUid;
  const second = "secondUid" in row.patch ? row.patch.secondUid : w.row?.secondUid;
  if (coach != null && coach === second) return { ok: false, code: "same_person" };
  if (entry.fields.length > 0) {
    const rev = w.entry.rev + 1;
    const edits = stamp(w.entry.edits, rev, w, entry.fields);
    await updateEntry(tx, w.entry.id, { ...entry.patch, rev, edits });
  }
  if (w.row && row.fields.length > 0) {
    const rev = w.row.rev + 1;
    await updateWeekRow(tx, w.row.id, {
      ...row.patch,
      rev,
      edits: stamp(w.row.edits, rev, w, row.fields),
    });
  }
  return { ok: true };
}

async function conflicts(
  db: Db,
  access: WorkspaceAccess,
  s: { stale: readonly FieldChange[]; entry: EntryRow; row: OccurrenceRow | null },
  roster: Map<number, string>,
): Promise<Conflict[]> {
  const editOf = (f: Field) => (WEEK_FIELDS.includes(f) ? s.row?.edits : s.entry.edits)?.[f];
  const ids = s.stale
    .map((c) => editOf(c.field)?.by)
    .filter((by): by is number => typeof by === "number");
  const names = await officerNames(db, access.workspaceId, [...new Set(ids)]);
  return s.stale.map(({ field, value }) => {
    const edit = editOf(field);
    // A picked member is sent as a uid; the sentence names them from the roster.
    const mine =
      value && typeof value === "object" && "uid" in value
        ? { ...value, name: roster.get(value.uid) ?? "" }
        : value;
    return {
      field,
      version: edit?.v ?? 0,
      value: valueOf(s.entry, s.row, field),
      mine,
      by: edit?.by == null ? null : (names.get(edit.by) ?? null),
      at: edit?.at ?? null,
    };
  });
}

/**
 * Deletes: `all` the entry, `one` only its week (a weekly entry keeps its other weeks), `after` its week
 * and every later one (from its first week, that is the whole entry).
 */
export async function removeEntry(
  db: Db,
  access: WorkspaceAccess,
  request: { entry: number; scope: "all" | "one" | "after"; week: string },
): Promise<"ok" | "not_found"> {
  const { entry: id, scope, week } = request;
  const entry = await findEntry(db, access.workspaceId, id);
  if (!entry) return "not_found";
  if (scope !== "all" && (!isDay(week) || !inPlan(entry, week))) return "not_found";
  if (scope === "all" || !entry.weekly || (scope === "after" && week <= firstWeek(entry))) {
    await deleteEntry(db, access.workspaceId, id);
  } else if (scope === "after") {
    await updateEntry(db, id, { lastWeek: addDays(week, -7) });
  } else {
    await db.transaction(async (tx) => {
      const row = await lockWeekRow(tx, access.workspaceId, id, week);
      await updateWeekRow(tx, row.id, { cancelled: true });
    });
  }
  return "ok";
}
