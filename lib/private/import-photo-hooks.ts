// Two save hooks of the screenshot import (issue 299, D96) whose destinations other sessions own:
// - Member update: a chat picture's main squad might and AD Tech % become member facts (D80), one new
//   version per field "from a message" (the facts' own source for what a member said). 11f's paste parser
//   reads each message. A stale write rolls the save back with the newer values (409), as 11f's editor
//   answers. AD Tech at 100 % is complete: a member already there is not written again.
// - Secret Ops report: the entries become thefts (D97) through 11j's saveSecretOpsDraft, for the member
//   the officer names as the report's owner.
import type { Db } from "../db";
import { mergePages } from "../screenshot/merge";
import { parseSecretOpsReport } from "../screenshot/parse-secret-ops";
import type { WorkspaceAccess } from "./access";
import type { ReadRow, SaveHook, Saving } from "./import-kinds";
import { SaveRefused } from "./import-kinds";
import { factsOf, saveFacts, type FactChange } from "./member-facts";
import { parseOnboarding } from "./onboarding-parse";
import { saveSecretOpsDraft } from "./thefts-import";

/** `Lv.28 [OGs] Ana`: a chat sender line; group 1 is the name (its first word). */
const SENDER = /\.\s?\d{1,2}\b.{0,12}[[({]\s*[A-Za-z0-9]{1,6}\s*[\])}]\s*(\S+)/;
/** AD Tech at this value is complete. */
const AD_COMPLETE = 100;

/** Each message of a chat page: its sender's name and the lines under it, up to the next sender. */
function messages(lines: readonly string[]): { name: string; lines: string[] }[] {
  const out: { name: string; lines: string[] }[] = [];
  for (const line of lines) {
    const sender = SENDER.exec(line)?.[1];
    if (sender !== undefined) out.push({ name: sender.replace(/[^\p{L}\p{N}]+$/u, ""), lines: [] });
    else out.at(-1)?.lines.push(line);
  }
  return out;
}

/** Rows "sender · fact · value" for every message that states a squad might or an AD Tech %. */
function readChat(lines: readonly string[]): ReadRow[] {
  return messages(lines).flatMap(({ name, lines: said }) => {
    const facts = parseOnboarding(said, new Date(), "UTC");
    return (["squadMight", "adTech"] as const).flatMap((field) => {
      const value = facts[field];
      return value === null ? [] : [{ rank: null, name, value, flags: [], field }];
    });
  });
}

async function saveMemberUpdate(db: Db, access: WorkspaceAccess, saving: Saving) {
  const facts = await factsOf(db, access);
  const conflicts: unknown[] = [];
  for (const uid of new Set(saving.rows.map((r) => r.uid))) {
    const complete = facts.get(uid)?.adTech?.value === AD_COMPLETE;
    const changes = saving.rows
      .filter((r) => r.uid === uid && r.field && !(r.field === "adTech" && complete))
      .map((r) => ({ field: r.field, version: r.version ?? 0, value: r.value, source: "message" }));
    const results = await saveFacts(db, access, uid, changes as FactChange[], saving.now);
    if (results === null) throw new SaveRefused("not_in_alliance");
    for (const r of results.filter((x) => x.status === "conflict")) conflicts.push({ uid, ...r });
  }
  if (conflicts.length > 0) throw new SaveRefused("conflict", conflicts);
  return {};
}

export const memberUpdate: SaveHook = {
  read(pages) {
    const rows = mergePages(pages.map(readChat)).filter(
      (row, i, all) =>
        all.findIndex(
          (o) => o.name === row.name && o.field === row.field && o.value === row.value,
        ) === i,
    );
    return { rows, leftOut: 0 };
  },
  save: saveMemberUpdate,
};

export const secretOps: SaveHook = {
  read(pages) {
    const seen = new Set<string>();
    const rows: ReadRow[] = [];
    for (const entry of pages.flatMap((lines) => parseSecretOpsReport(lines))) {
      const key = `${entry.kind}|${entry.tag}|${entry.name}|${entry.at}`;
      if (seen.has(key) && entry.at !== null) continue;
      seen.add(key);
      rows.push({ rank: null, name: entry.name, value: null, flags: [], entry });
    }
    return { rows, leftOut: 0 };
  },
  async save(db, access, saving) {
    const report = saving.secretOps ?? { victimUid: null, entries: [] };
    const saved = await saveSecretOpsDraft(
      db,
      access,
      // The picture's server day gives the report's "MM-DD" times their year.
      {
        victimUid: report.victimUid,
        readAt: new Date(`${saving.pictureDay}T12:00:00Z`),
        entries: report.entries,
      },
      { now: saving.now, zone: saving.zone },
    );
    if (saved === "not_in_alliance" || saved === "attacker_missing") throw new SaveRefused(saved);
    return { thefts: saved };
  },
  matchMembers: false,
};
