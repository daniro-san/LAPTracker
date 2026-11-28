// Member facts (issue #297, D80): the newest value of each field for the workspace's members, and the
// officers' writes. A write is one field at a time and appends a version (history kept). It names the
// version it was based on: when another officer saved that field since, notes are combined and languages
// joined, and any other field is refused with the newer value (409), so nobody's edit vanishes. Only
// members of the workspace's own alliance (access.unionId, D71), now or before (D107), and the
// workspace's pending members (D106) can have facts.
import { z } from "zod";

import type { Db } from "../db";
import { ownAwayOf } from "../member-away";
import { factVersion, insertFact, latestFacts, type FactRow } from "../repo/member-facts";
import { findPending } from "../repo/pending-members";
import { awayReports } from "../repo/self-reports";
import { anyRoster } from "../repo/workspace-any-roster";
import { wasInRoster } from "../repo/workspace-past-roster";
import type { WorkspaceAccess } from "./access";
import { dayIn, isDay } from "./calendar-time";
import {
  LANGUAGES,
  MERGED_FIELDS,
  mergeLanguages,
  mergeNotes,
  OFFICER_STATUSES,
  TIER_MAX,
  type FactField,
  type FactSource,
  type MemberFacts,
} from "./fact-fields";

const isZone = (id: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: id });
    return true;
  } catch {
    return false;
  }
};

/** The largest serial id (Postgres integer). */
const PG_INT_MAX = 2_147_483_647;

const text = (max: number) => z.string().trim().max(max);
const DAY = z.string().refine(isDay);

/** Each field's value; null clears it. A member's own report (D154) takes the same values. */
export const FACT_VALUES = {
  squadMight: z.number().int().min(0).max(1e11),
  adTech: z.number().min(0).max(100),
  troopTier: z.number().int().min(1).max(TIER_MAX),
  timeZone: z.string().max(64).refine(isZone),
  languages: z.array(z.enum(LANGUAGES)).max(LANGUAGES.length),
  status: z.enum(OFFICER_STATUSES),
  away: z
    .object({ text: text(500), from: DAY.nullable().optional(), until: DAY.nullable() })
    .strict()
    .refine((a) => !a.from || !a.until || a.from <= a.until),
  notes: text(4000),
} satisfies Record<FactField, z.ZodType>;

const change = <F extends FactField>(field: F) =>
  z
    .object({
      field: z.literal(field),
      /** The version the officer saw; 0 when the field had none. */
      version: z.number().int().min(0),
      value: FACT_VALUES[field].nullable(),
      source: z.enum(["message", "officer"]),
    })
    .strict();

/** One field's write, as the card's editor sends it. */
export const FACT_CHANGE = z.discriminatedUnion("field", [
  change("squadMight"),
  change("adTech"),
  change("troopTier"),
  change("timeZone"),
  change("languages"),
  change("status"),
  change("away"),
  change("notes"),
]);
export type FactChange = z.infer<typeof FACT_CHANGE>;

export type ChangeResult = {
  field: FactField;
  /** saved; merged with a newer edit; refused because another officer saved a newer value. */
  status: "saved" | "merged" | "conflict";
  version: number;
  value: unknown;
  source: FactSource;
};

/** An empty note, an away note with neither words nor a day, or no language is no value. */
function normalise(c: FactChange): unknown {
  const v = c.value;
  if (v === null || v === "") return null;
  if (Array.isArray(v)) return v.length === 0 ? null : LANGUAGES.filter((l) => v.includes(l));
  if (typeof v === "object" && "until" in v)
    return v.text === "" && v.until === null && !v.from ? null : v;
  return v;
}

/**
 * The newest value of every field, per member of the workspace. Languages come in LANGUAGES order
 * whatever order they were stored in (an old sheet import kept the sheet's), so an editor opened on them
 * starts unchanged.
 */
export async function factsOf(db: Db, access: WorkspaceAccess): Promise<Map<number, MemberFacts>> {
  const facts = new Map<number, MemberFacts>();
  const [rows, away] = await Promise.all([
    latestFacts(db, access.workspaceId),
    awayReports(db, access.workspaceId),
  ]);
  for (const r of rows) {
    const own = facts.get(r.uid) ?? {};
    const value =
      r.field === "languages" && Array.isArray(r.value)
        ? LANGUAGES.filter((l) => (r.value as string[]).includes(l))
        : r.value;
    const at = r.writtenAt.toISOString();
    Object.assign(own, { [r.field]: { value, source: r.source, version: r.version, at } });
    facts.set(r.uid, own);
  }
  // Issue 829: a member's own away days lie over the facts, never inside them.
  for (const a of away) {
    const own = facts.get(a.uid) ?? {};
    own.ownAway = ownAwayOf(a.value, a.writtenAt);
    facts.set(a.uid, own);
  }
  return facts;
}

/**
 * The time zones of `uids` (the newest roster's members and the open new members), most used first;
 * former and removed new members do not count.
 */
export function usedZones(facts: Map<number, MemberFacts>, uids: Iterable<number>): string[] {
  const count = new Map<string, number>();
  for (const uid of uids) {
    const zone = facts.get(uid)?.timeZone?.value;
    if (zone) count.set(zone, (count.get(zone) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([z]) => z);
}

/** Whether `uid` is in the alliance's newest roster (end-of-day read or any other). */
export async function isMember(db: Db, access: WorkspaceAccess, uid: number): Promise<boolean> {
  const roster = await anyRoster(db, access.unionId);
  return roster?.members.some((m) => m.uid === uid) ?? false;
}

/**
 * Whether `uid` may have facts written: a member now, a former member (any earlier roster of this
 * alliance, D107), or an open pending member of this workspace (`-id`, D106). Only facts are widened:
 * roll calls and every other write keep `isMember`.
 */
async function mayHaveFacts(db: Db, access: WorkspaceAccess, uid: number): Promise<boolean> {
  // A pending member's id is a Postgres integer: anything below its range is no one (not a 500).
  if (uid < 0)
    return uid >= -PG_INT_MAX && (await findPending(db, access.workspaceId, { id: -uid })) !== null;
  return (await isMember(db, access, uid)) || wasInRoster(db, access.unionId, uid);
}

const combine = (field: FactField, base: unknown, mine: unknown, theirs: unknown): unknown =>
  field === "notes"
    ? mergeNotes(base as string | null, (mine as string | null) ?? "", theirs as string | null) ||
      null
    : mergeLanguages(
        base as string[] | null,
        (mine as string[] | null) ?? [],
        theirs as string[] | null,
      );

const refused = (field: FactField, newest: FactRow): ChangeResult => ({
  field,
  status: "conflict",
  version: newest.version,
  value: newest.value,
  source: newest.source,
});

async function saveOne(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  c: FactChange,
  now: Date,
  zone: string | undefined,
): Promise<ChangeResult> {
  const where = [db, access.workspaceId, uid, c.field] as const;
  const newest = await factVersion(...where, "newest");
  const current = newest?.version ?? 0;
  let value = startsToday(normalise(c), now, zone);
  let status: ChangeResult["status"] = "saved";
  if (newest && c.version !== current) {
    // Two officers typed the same thing: nothing to refuse.
    if (JSON.stringify(newest.value) === JSON.stringify(value))
      return { ...refused(c.field, newest), status: "saved" };
    if (!MERGED_FIELDS.includes(c.field) || c.version > current) return refused(c.field, newest);
    const base = c.version === 0 ? null : await factVersion(...where, c.version);
    value = combine(c.field, base?.value ?? null, value, newest.value);
    status = "merged";
  }
  const row = { workspaceId: access.workspaceId, uid, field: c.field, version: current + 1 };
  const written = { value, source: c.source, writtenBy: access.user.id, writtenAt: now };
  if (await insertFact(db, { ...row, ...written })) {
    return { field: c.field, status, version: current + 1, value, source: c.source };
  }
  // Another officer saved this field between the read and the write.
  return refused(c.field, (await factVersion(...where, "newest")) as FactRow);
}

/**
 * An away note saved without a first day starts on the server day of the save (D103), so it never
 * reaches into past roll calls or caravans. Without `zone` (the screenshot import) nothing is added.
 */
function startsToday(value: unknown, now: Date, zone: string | undefined): unknown {
  if (!zone || typeof value !== "object" || value === null || !("until" in value)) return value;
  return (value as { from?: string | null }).from
    ? value
    : { ...value, from: dayIn(zone, now.getTime()) };
}

/**
 * Writes each field in turn; null when `uid` may not have facts (`mayHaveFacts`). `zone` is the
 * server's (SERVER_TZ), for an away note's first day.
 */
export async function saveFacts(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  changes: readonly FactChange[],
  now: Date,
  zone?: string,
): Promise<ChangeResult[] | null> {
  if (!(await mayHaveFacts(db, access, uid))) return null;
  const results: ChangeResult[] = [];
  for (const c of changes) results.push(await saveOne(db, access, uid, c, now, zone));
  return results;
}

/**
 * An officer's "Put on the card" of what a member sent about themselves (D154): the next version of that
 * fact with source `member`, only while the fact is still at the version the card showed. Unlike an
 * officer's edit it is never combined (languages too): any save since, even one landing between this read
 * and the write, is refused with the newer value, because the unique version lets only one write in and a
 * combined list is a value nobody saw. Null when the uid is not in the alliance's newest roster.
 */
export async function saveMemberFact(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  change: { field: "adTech" | "timeZone" | "languages"; version: number; value: unknown },
  now: Date,
): Promise<ChangeResult | null> {
  if (!(await isMember(db, access, uid))) return null;
  const where = [db, access.workspaceId, uid, change.field] as const;
  const newest = await factVersion(...where, "newest");
  const current = newest?.version ?? 0;
  const value = normalise({ ...change, source: "officer" } as FactChange);
  const row = { workspaceId: access.workspaceId, uid, field: change.field, version: current + 1 };
  const written = { value, source: "member" as const, writtenBy: access.user.id, writtenAt: now };
  if (current === change.version && (await insertFact(db, { ...row, ...written }))) {
    return { field: change.field, status: "saved", version: current + 1, value, source: "member" };
  }
  // Another officer saved first: the newer value, or none when the card named a version that is gone.
  const latest = (await factVersion(...where, "newest")) ?? newest;
  if (latest) return refused(change.field, latest);
  return { field: change.field, status: "conflict", version: 0, value: null, source: "officer" };
}
