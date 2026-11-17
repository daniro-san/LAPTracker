// The kinds this build can save (issue 299, D96): Alliance Duel points per member per day and per week,
// and the donation, might and kills rankings as a check against our own reads, of which only the counts
// are kept; member updates and Secret Ops reports (import-photo-hooks.ts). A kind missing from SAVE_HOOKS
// is recognised but "coming soon" (import-kinds.ts).
import type { Db } from "../db";
import { duelWeek, insertCheck, newestRoster, saveDuelPoints } from "../repo/import";
import { endOfDayReads } from "../repo/workspace-rosters";
import { mergePages } from "../screenshot/merge";
import { nameKey } from "../screenshot/name-key";
import { parseAllianceDuelRanking } from "../screenshot/parse-alliance-duel";
import { parseRanking } from "../screenshot/parse-ranking";
import type { WorkspaceAccess } from "./access";
import type { ImportKind, ReadRow, SaveHook, Screen } from "./import-kinds";
import { memberUpdate, secretOps } from "./import-photo-hooks";
import { gameWeek, weekDonations, weekTotal } from "./member-week";

/** End-of-day reads a weekly donation check sums: a full week. */
const WEEK_READS = 8;

/**
 * A tag read from the picture is the workspace's own when it folds to the same letters (the OCR reads
 * OGs as 0Gs or 065) or one letter apart. An unread tag counts as our own: the member match decides.
 */
export function isOwnTag(tag: string, own: string): boolean {
  if (tag === "") return true;
  const fold = (s: string) =>
    nameKey(s.replace(/0/g, "o").replace(/5/g, "s").replace(/6/g, "g").replace(/1/g, "l"));
  const [a, b] = [fold(tag), fold(own)];
  return a === b || (b.length >= 3 && edits(a, b) <= 1);
}

/** Levenshtein distance between two short strings (tags have at most six letters). */
function edits(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      const swap = (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      next[j] = Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, swap);
    }
    row = next;
  }
  return row[b.length] ?? 0;
}

const duel: SaveHook = {
  read(pages, scope, own) {
    let leftOut = 0;
    const read = pages.map((lines) =>
      parseAllianceDuelRanking(lines, { scope: scope ?? "weekly" }).flatMap((r) => {
        if (!isOwnTag(r.tag, own)) {
          leftOut += 1;
          return [];
        }
        return [{ rank: r.rank, name: r.name, value: r.points, flags: [...r.flags] }];
      }),
    );
    return { rows: mergePages(read), leftOut };
  },
  async save(db, access, saving) {
    if (!saving.duel) throw new Error("an Alliance Duel draft needs its week and day");
    const points = saving.rows.map((r) => ({ uid: r.uid, points: r.value }));
    await saveDuelPoints(db, access.workspaceId, saving.duel, points, saving);
    return {};
  },
};

function readRanking(pages: readonly (readonly string[])[]): { rows: ReadRow[]; leftOut: number } {
  const read = pages.map((lines) =>
    parseRanking(lines).map((r) => ({ ...r, flags: [...r.flags] as string[] })),
  );
  return { rows: mergePages(read), leftOut: 0 };
}

/**
 * Our own value for each member, to compare a ranking with: might and kills from the newest daily
 * roster; donations from the end-of-day reads (D72): the day's, or the week's total so far. A member
 * with no value is left out of the comparison (D75: no data never counts).
 */
export async function oursFor(
  db: Db,
  access: WorkspaceAccess,
  screen: Screen,
  pictureDay: string,
): Promise<Map<number, number | null>> {
  if (screen.kind === "might" || screen.kind === "kills") {
    const roster = await newestRoster(db, access.unionId);
    const key = screen.kind;
    return new Map(roster.map((m) => [m.uid, m[key]]));
  }
  const reads = await endOfDayReads(db, access.unionId, WEEK_READS);
  const week = gameWeek(pictureDay);
  const uids = new Set(reads.flatMap((r) => r.members.map((m) => m.uid)));
  return new Map(
    [...uids].map((uid) => {
      if (screen.scope === "weekly") return [uid, weekTotal(weekDonations(reads, week, uid))];
      const day = reads.find((r) => r.day === pictureDay);
      return [uid, day?.members.find((m) => m.uid === uid)?.dailyTech ?? null];
    }),
  );
}

const check: SaveHook = {
  read: (pages) => readRanking(pages),
  async save(db, access, saving) {
    const ours = await oursFor(db, access, saving.screen, saving.pictureDay);
    const compared = saving.rows.filter((r) => (ours.get(r.uid) ?? null) !== null);
    const same = compared.filter((r) => ours.get(r.uid) === r.value).length;
    await insertCheck(db, {
      workspaceId: access.workspaceId,
      kind: saving.screen.kind,
      scope: saving.screen.scope,
      pictureDay: saving.pictureDay,
      rows: saving.rows.length,
      compared: compared.length,
      same,
      differ: compared.length - same,
      savedBy: saving.userId,
      savedAt: saving.now,
    });
    return {};
  },
};

/** The kinds this build saves; event results and Elixir teams (issue 298) add theirs here. */
export const SAVE_HOOKS: Partial<Record<ImportKind, SaveHook>> = {
  alliance_duel: duel,
  donation: check,
  might: check,
  kills: check,
  member_update: memberUpdate,
  secret_ops: secretOps,
};

export const canSave = (kind: ImportKind) => SAVE_HOOKS[kind] !== undefined;

/** The kinds an officer may pick for a picture or a draft: the ones that save. */
export const SAVED_KINDS = Object.keys(SAVE_HOOKS) as ImportKind[];

/** The Alliance Duel points already saved for the draft's week: per member, the week and each day. */
export async function duelSaved(
  db: Db,
  access: WorkspaceAccess,
  week: string,
): Promise<Map<number, Partial<Record<string, number>>>> {
  const saved = new Map<number, Partial<Record<string, number>>>();
  for (const row of await duelWeek(db, access.workspaceId, week)) {
    saved.set(row.uid, { ...saved.get(row.uid), [row.day]: row.points });
  }
  return saved;
}
