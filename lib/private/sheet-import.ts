// The one-time sheet import (issue #297, D80): each named row of a sheet matched to a member of the
// workspace's own alliance (D71). First the name a person confirmed once (name_aliases), then the
// current and past names the alliance's rosters hold, through lib/screenshot's matcher (confusables,
// decorations, the "R4 " prefix, "++" and "+-"). A doubtful or unknown row waits for a person, whose
// choice is remembered, and nothing is written until every row is matched or dismissed. The facts land
// "from the sheet" only in fields that hold no value yet, so no officer's or message's value is
// overwritten and importing a sheet again writes nothing.
import type { Db } from "../db";
import {
  aliasesOf,
  insertFacts,
  latestFacts,
  saveAliases,
  type FactRow,
} from "../repo/member-facts";
import { anyRoster, namesSeen } from "../repo/workspace-any-roster";
import { matchName, type NameCandidate } from "../screenshot/match-name";
import { nameKey } from "../screenshot/name-key";
import type { WorkspaceAccess } from "./access";
import { readSheet, type Sheet, type SheetRow } from "./sheet-parse";

export type RowMatch =
  | { status: "matched"; uid: number; via: "current" | "past" | "segment" | "alias" }
  /** A person said "not a member" for this name before. */
  | { status: "dismissed" }
  | { status: "unsure"; suggestions: number[] }
  | { status: "none" };

export interface ImportRow extends SheetRow {
  match: RowMatch;
}

export interface ImportPreview {
  columns: Sheet["columns"];
  rows: ImportRow[];
  /** The alliance's members, by name, for a person to pick from. */
  members: { uid: number; name: string }[];
}

/** A person's answer for a row the matcher left open: a member, or null for "not a member". */
export interface Decision {
  line: number;
  uid: number | null;
}

export interface ImportResult {
  matched: number;
  dismissed: number;
  /** Members who got at least one fact. */
  members: number;
  saved: number;
  /** Values the sheet had for a field that already held one. */
  kept: number;
}

interface Where {
  now: Date;
  serverZone: string;
}

function matchRow(
  name: string,
  candidates: readonly NameCandidate[],
  aliases: Map<string, number | null>,
  current: Set<number>,
): RowMatch {
  const remembered = aliases.get(nameKey(name));
  if (remembered === null) return { status: "dismissed" };
  if (remembered !== undefined && current.has(remembered))
    return { status: "matched", uid: remembered, via: "alias" };
  const m = matchName(name, candidates);
  return m.status === "unsure"
    ? { status: "unsure", suggestions: m.suggestions.map((s) => s.uid) }
    : m;
}

async function prepare(db: Db, access: WorkspaceAccess, csv: string, w: Where) {
  const sheet = readSheet(csv, w.now, w.serverZone);
  if (!sheet) return null;
  const [roster, seen, aliases] = await Promise.all([
    anyRoster(db, access.unionId),
    namesSeen(db, access.unionId),
    aliasesOf(db, access.workspaceId),
  ]);
  const members = roster?.members ?? [];
  const current = new Set(members.map((m) => m.uid));
  const candidates = members.map((m) => ({
    uid: m.uid,
    names: [m.name, ...(seen.get(m.uid) ?? []).filter((n) => n !== m.name)],
  }));
  return {
    columns: sheet.columns,
    rows: sheet.rows.map((r) => ({ ...r, match: matchRow(r.name, candidates, aliases, current) })),
    members: members
      .map((m) => ({ uid: m.uid, name: m.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    current,
  };
}

/** The sheet's rows and how each matches; null when no row of it names a "Name" column. */
export async function previewImport(
  db: Db,
  access: WorkspaceAccess,
  csv: string,
  w: Where,
): Promise<ImportPreview | null> {
  const p = await prepare(db, access, csv, w);
  return p && { columns: p.columns, rows: p.rows, members: p.members };
}

const isOpen = (r: ImportRow) => r.match.status === "unsure" || r.match.status === "none";

type NewFact = Parameters<typeof insertFacts>[1][number];

/** The facts to write: one per member and field, only where the field holds no value yet. */
function plan(
  rows: readonly ImportRow[],
  uidOf: (r: ImportRow) => number | null,
  newest: Map<string, FactRow>,
  by: Pick<NewFact, "workspaceId" | "writtenBy" | "writtenAt">,
): { planned: NewFact[]; kept: number } {
  const planned = new Map<string, NewFact>();
  let kept = 0;
  for (const r of rows) {
    const uid = uidOf(r);
    if (uid === null) continue;
    for (const [field, value] of Object.entries(r.facts)) {
      const key = `${uid} ${field}`;
      const had = newest.get(key);
      if ((had && had.value !== null) || planned.has(key)) kept++;
      else
        planned.set(key, {
          ...by,
          uid,
          field,
          version: (had?.version ?? 0) + 1,
          value,
          source: "sheet",
        });
    }
  }
  return { planned: [...planned.values()], kept };
}

/**
 * Writes the sheet once every row is matched or dismissed: the people's answers become remembered
 * names, and the facts go to the fields that hold nothing yet.
 */
export async function applyImport(
  db: Db,
  access: WorkspaceAccess,
  csv: string,
  decisions: readonly Decision[],
  w: Where,
): Promise<ImportResult | "no_name_column" | "undecided" | "not_member"> {
  const p = await prepare(db, access, csv, w);
  if (!p) return "no_name_column";
  const decided = new Map(decisions.map((d) => [d.line, d.uid]));
  const open = p.rows.filter(isOpen);
  if (open.some((r) => !decided.has(r.line))) return "undecided";
  const answers = open.map((r) => ({ nameKey: nameKey(r.name), uid: decided.get(r.line) ?? null }));
  if (answers.some((a) => a.uid !== null && !p.current.has(a.uid))) return "not_member";
  const remembered = answers.filter((a) => a.nameKey !== "");
  await saveAliases(db, access.workspaceId, remembered, access.user.id, w.now);
  const uidOf = (r: ImportRow) =>
    r.match.status === "matched" ? r.match.uid : isOpen(r) ? (decided.get(r.line) ?? null) : null;
  const facts = await latestFacts(db, access.workspaceId);
  const newest = new Map(facts.map((f) => [`${f.uid} ${f.field}`, f]));
  const by = { workspaceId: access.workspaceId, writtenBy: access.user.id, writtenAt: w.now };
  const { planned, kept } = plan(p.rows, uidOf, newest, by);
  const saved = await insertFacts(db, planned);
  return {
    matched: p.rows.filter((r) => uidOf(r) !== null).length,
    dismissed: p.rows.filter((r) => uidOf(r) === null).length,
    members: new Set(planned.map((f) => f.uid)).size,
    saved,
    kept: kept + planned.length - saved,
  };
}
