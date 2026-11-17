// Member facts (issue #297, D80): the newest value of each field for the workspace's members, and the
// officers' writes. A write is one field at a time and appends a version (history kept). It names the
// version it was based on: when another officer saved that field since, notes are combined and languages
// joined, and any other field is refused with the newer value (409), so nobody's edit vanishes. Only
// members of the workspace's own alliance (access.unionId, D71) can have facts.
import { z } from "zod";

import type { Db } from "../db";
import { factVersion, insertFact, latestFacts, type FactRow } from "../repo/member-facts";
import { anyRoster } from "../repo/workspace-any-roster";
import type { WorkspaceAccess } from "./access";
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

const text = (max: number) => z.string().trim().max(max);
const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Each field's value; null clears it. */
const VALUES = {
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
      value: VALUES[field].nullable(),
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
  for (const r of await latestFacts(db, access.workspaceId)) {
    const own = facts.get(r.uid) ?? {};
    const value =
      r.field === "languages" && Array.isArray(r.value)
        ? LANGUAGES.filter((l) => (r.value as string[]).includes(l))
        : r.value;
    Object.assign(own, { [r.field]: { value, source: r.source, version: r.version } });
    facts.set(r.uid, own);
  }
  return facts;
}

/** The time zones the workspace's members have, most used first. */
export function usedZones(facts: Map<number, MemberFacts>): string[] {
  const count = new Map<string, number>();
  for (const f of facts.values()) {
    const zone = f.timeZone?.value;
    if (zone) count.set(zone, (count.get(zone) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([z]) => z);
}

/** Whether `uid` is in the alliance's newest roster (end-of-day read or any other). */
export async function isMember(db: Db, access: WorkspaceAccess, uid: number): Promise<boolean> {
  const roster = await anyRoster(db, access.unionId);
  return roster?.members.some((m) => m.uid === uid) ?? false;
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
): Promise<ChangeResult> {
  const where = [db, access.workspaceId, uid, c.field] as const;
  const newest = await factVersion(...where, "newest");
  const current = newest?.version ?? 0;
  let value = normalise(c);
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

/** Writes each field in turn; null when `uid` is not in the workspace's own alliance. */
export async function saveFacts(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  changes: readonly FactChange[],
  now: Date,
): Promise<ChangeResult[] | null> {
  if (!(await isMember(db, access, uid))) return null;
  const results: ChangeResult[] = [];
  for (const c of changes) results.push(await saveOne(db, access, uid, c, now));
  return results;
}
