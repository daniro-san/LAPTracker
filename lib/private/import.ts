// The screenshot import (issue 299, D96): pictures read by the OCR become drafts that every officer of the
// workspace reviews. Nothing counts before Save (D75), the first save wins, and a draft lasts 7 days. No
// picture reaches this module: only each picture's OCR text lines, which the draft keeps.
import { ALLIANCES } from "../../config/alliances";
import type { Db } from "../db";
import {
  closeDraft,
  findDraft,
  insertDrafts,
  newestRoster,
  pastNames,
  retypeDraft,
  type DuelDay,
  type StoredRow,
} from "../repo/import";
import type { Classified } from "../screenshot/classify";
import { matchName, type NameCandidate } from "../screenshot/match-name";
import type { WorkspaceAccess } from "./access";
import {
  SaveRefused,
  SCOPED,
  type ImportKind,
  type PhotoFact,
  type ReadRow,
  type SaveExtra,
  type SaveHook,
  type Saving,
  type Scope,
  type Screen,
} from "./import-kinds";
import { SAVE_HOOKS } from "./import-save";
import { DAY_MS, gameWeek, isoDay } from "./member-week";
import { rowsFit, withNewMembers } from "./pending-members";

/** A draft not saved or discarded is deleted after this long (issue 299). */
export const DRAFT_DAYS = 7;
/** Pictures in one send: a long ranking is about 13 pages of 8 rows; more are refused. */
export const MAX_PICTURES = 16;
/** Past names count for the match when they were seen this recently. */
const NAME_HISTORY_DAYS = 60;

/** One picture after the OCR: its text lines and what they were classified as. */
export interface PictureText {
  lines: string[];
  classified: Classified;
}

/** What became of one picture: a draft (its index in `drafts`), or why there is none. */
export type Outcome =
  | { status: "draft"; draft: number }
  | { status: "unrecognised" }
  | { status: "map" }
  | { status: "soon"; kind: ImportKind }
  | { status: "empty"; kind: ImportKind };

export interface DraftSummary {
  id: number;
  kind: ImportKind;
  scope: Scope | null;
  /** False when Daily or Weekly is only a guess (the picture shows both tabs alike). */
  scopeSure: boolean;
  rows: number;
  doubtful: number;
  notFound: number;
  leftOut: number;
}

export interface Sent {
  source: "desk" | "discord";
  sentBy: string | null;
  /** The server day the pictures belong to. */
  pictureDay: string;
  now: Date;
}

/** The workspace's members as name candidates: the newest daily roster, with names seen recently. */
async function candidatesOf(db: Db, access: WorkspaceAccess, now: Date) {
  const roster = await newestRoster(db, access.unionId);
  const since = isoDay(now.getTime() - NAME_HISTORY_DAYS * DAY_MS);
  const past = await pastNames(
    db,
    access.unionId,
    roster.map((m) => m.uid),
    since,
  );
  return roster.map((m) => ({
    uid: m.uid,
    names: [m.name, ...past.filter((p) => p.uid === m.uid && p.name !== m.name).map((p) => p.name)],
  }));
}

/**
 * sure: one member fits; doubtful: a few might (the officer picks); none: nobody in the alliance. A hook
 * whose rows are not members (a report's attackers) gets no match.
 */
function matched(rows: ReadRow[], candidates: NameCandidate[], hook: SaveHook): StoredRow[] {
  if (hook.matchMembers === false)
    return rows.map((row) => ({ ...row, match: { status: "none" } }));
  return rows.map((row) => {
    const match = matchName(row.name, candidates);
    if (match.status === "matched") return { ...row, match: { status: "sure", uid: match.uid } };
    if (match.status === "unsure")
      return { ...row, match: { status: "doubtful", uids: match.suggestions.map((s) => s.uid) } };
    return { ...row, match: { status: "none" } };
  });
}

/** The screen a picture is read as: the officer's pick, else the classifier's. A map stays a map. */
function screenOf(c: Classified, pick: Screen | undefined): Screen | "map" | null {
  if (c.kind === "map") return "map";
  if (pick) return pick;
  return c.kind === null ? null : { kind: c.kind, scope: c.scope };
}

export const ownTag = (access: WorkspaceAccess) =>
  ALLIANCES.find((a) => a.unionId === access.unionId)?.tag ?? "";

/**
 * Drafts from pictures sent together. Pictures of one kind (and tab) merge into one draft: the pages of
 * a long ranking. A picture not recognised, a map, a kind not saved yet and a page with no rows make no
 * draft. `pick` is the officer's choice for pictures that were not recognised.
 */
export async function createDrafts(
  db: Db,
  access: WorkspaceAccess,
  pictures: PictureText[],
  sent: Sent,
  pick?: Screen,
): Promise<{ drafts: DraftSummary[]; outcomes: Outcome[] }> {
  const screens = pictures.map((p) => screenOf(p.classified, pick));
  const outcomes: Outcome[] = screens.map((s) =>
    s === null
      ? { status: "unrecognised" }
      : s === "map"
        ? { status: "map" }
        : { status: "soon", kind: s.kind },
  );
  const groups = new Map<string, number[]>();
  screens.forEach((s, i) => {
    if (s === null || s === "map" || !SAVE_HOOKS[s.kind]) return;
    const key = `${s.kind}:${s.scope}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const candidates = groups.size > 0 ? await candidatesOf(db, access, sent.now) : [];
  const drafts: (DraftSummary & { at: number[] })[] = [];
  const inserts = [];
  for (const at of groups.values()) {
    const screen = screens[at[0] as number] as Screen;
    const read = SAVE_HOOKS[screen.kind]?.read(
      at.map((i) => (pictures[i] as PictureText).lines),
      screen.scope,
      ownTag(access),
    );
    if (!read || read.rows.length === 0) {
      for (const i of at) outcomes[i] = { status: "empty", kind: screen.kind };
      continue;
    }
    const rows = matched(read.rows, candidates, SAVE_HOOKS[screen.kind] as SaveHook);
    const scopeSure = pick !== undefined || at.every((i) => pictures[i]?.classified.scopeSure);
    inserts.push({
      workspaceId: access.workspaceId,
      kind: screen.kind,
      scope: screen.scope,
      scopeSure,
      pictureDay: sent.pictureDay,
      pages: at.map((i) => (pictures[i] as PictureText).lines),
      rows,
      leftOut: read.leftOut,
      source: sent.source,
      sentBy: sent.sentBy,
      createdAt: sent.now,
      expiresAt: new Date(sent.now.getTime() + DRAFT_DAYS * DAY_MS),
    });
    drafts.push({
      ...summaryOf(rows),
      id: 0,
      kind: screen.kind,
      scope: screen.scope,
      scopeSure,
      leftOut: read.leftOut,
      at,
    });
  }
  const ids = await insertDrafts(db, inserts, sent.now);
  drafts.forEach((d, n) => {
    d.id = ids[n] as number;
    for (const i of d.at) outcomes[i] = { status: "draft", draft: n };
  });
  return { drafts: drafts.map(({ at: _, ...d }) => d), outcomes };
}

/** How many rows a draft has, and how many need a person to pick the member. */
export function summaryOf(rows: StoredRow[]): Pick<DraftSummary, "rows" | "doubtful" | "notFound"> {
  return {
    rows: rows.length,
    doubtful: rows.filter((r) => r.match.status === "doubtful").length,
    notFound: rows.filter((r) => r.match.status === "none").length,
  };
}

/** What a Save sends: the tab, the duel's day and week, and one value per member after the fixes. */
export interface SaveInput {
  version: number;
  scope: Scope | null;
  /** Alliance Duel, Daily: which day tab the picture showed. */
  day: Exclude<DuelDay, "week"> | null;
  /** Alliance Duel: the week before the picture's (a Sunday picture sent on Monday). */
  weekBefore: boolean;
  /**
   * A member update sends each fact with the version the officer saw (D80). A row for a new member not in
   * the roster yet sends `newName` instead of `uid` (D106).
   */
  rows: {
    uid?: number | undefined;
    newName?: string | undefined;
    value: number;
    field?: PhotoFact | undefined;
    version?: number | undefined;
  }[];
  /** Secret Ops report: whose report it is, and each entry kept (by its row) with its attacker as fixed. */
  report?: { victimUid: number | null; entries: { row: number; name: string }[] } | undefined;
}

export type SaveResult =
  | ({ ok: true } & SaveExtra)
  | {
      ok: false;
      code:
        | "gone"
        | "already_saved"
        | "discarded"
        | "changed"
        | "bad_rows"
        | "cannot_save"
        | SaveRefused["code"];
      by?: string | null;
      /** A member update's newer values, when another officer saved first (409). */
      detail?: unknown;
    };

/** Why a draft can no longer be saved, read again after a refused claim. */
async function whyNot(db: Db, access: WorkspaceAccess, id: number, now: Date): Promise<SaveResult> {
  const found = await findDraft(db, access.workspaceId, id, now);
  if (!found) return { ok: false, code: "gone" };
  const by = found.doneByName;
  if (found.draft.status === "saved") return { ok: false, code: "already_saved", by };
  if (found.draft.status === "discarded") return { ok: false, code: "discarded", by };
  return { ok: false, code: "changed" };
}

/** The game week (its Monday) and the day a duel draft saves to. */
function duelTarget(pictureDay: string, input: SaveInput): { week: string; day: DuelDay } | null {
  if (input.scope === "daily" && input.day === null) return null;
  const monday = gameWeek(pictureDay)[0] as string;
  const week = input.weekBefore ? isoDay(Date.parse(`${monday}T00:00:00Z`) - 7 * DAY_MS) : monday;
  return { week, day: input.scope === "daily" ? (input.day as DuelDay) : "week" };
}

/**
 * Saves a draft as the officer confirmed it. The claim (open, at the version the officer saw) and the
 * hook's writes run in one transaction: the first save wins, and a second gets who saved it.
 */
export async function saveDraft(
  db: Db,
  access: WorkspaceAccess,
  id: number,
  input: SaveInput,
  clock: { now: Date; zone: string },
): Promise<SaveResult> {
  const { now, zone } = clock;
  const found = await findDraft(db, access.workspaceId, id, now);
  if (!found) return { ok: false, code: "gone" };
  const draft = found.draft;
  const hook = SAVE_HOOKS[draft.kind as ImportKind];
  if (!hook) return { ok: false, code: "cannot_save" };
  const duel = draft.kind === "alliance_duel" ? duelTarget(draft.pictureDay, input) : null;
  const secretOps = reportOf(draft.rows, input.report);
  const missing =
    (draft.kind === "alliance_duel" && duel === null) ||
    (draft.kind === "secret_ops" && secretOps === null);
  if (missing || !(await rowsFit(db, access, input.rows))) return { ok: false, code: "bad_rows" };
  const saving: Omit<Saving, "rows"> = {
    screen: { kind: draft.kind as ImportKind, scope: input.scope },
    pictureDay: draft.pictureDay,
    duel,
    secretOps,
    userId: access.user.id,
    now,
    zone,
  };
  try {
    const done = await db.transaction(async (tx) => {
      const close = { status: "saved" as const, userId: access.user.id };
      if (!(await closeDraft(tx, access.workspaceId, id, input.version, close, now))) return null;
      const rows = await withNewMembers(tx, access, input.rows, now);
      return hook.save(tx, access, { ...saving, rows });
    });
    return done ? { ok: true, ...done } : whyNot(db, access, id, now);
  } catch (error) {
    if (!(error instanceof SaveRefused)) throw error;
    return { ok: false, code: error.code, detail: error.detail };
  }
}

/** A Secret Ops report's entries as kept, with their attackers as the officer fixed them; null when unusable. */
function reportOf(rows: StoredRow[], report: SaveInput["report"]): Saving["secretOps"] {
  if (!report) return null;
  const entries = report.entries.map(({ row, name }) => {
    const entry = rows[row]?.entry;
    return entry ? { ...entry, name } : null;
  });
  return entries.every((e) => e !== null) ? { victimUid: report.victimUid, entries } : null;
}

/** Discards a draft at the version the officer saw; the first close wins, as with a save. */
export async function discardDraft(
  db: Db,
  access: WorkspaceAccess,
  id: number,
  version: number,
  now: Date,
): Promise<SaveResult> {
  const close = { status: "discarded" as const, userId: access.user.id };
  return (await closeDraft(db, access.workspaceId, id, version, close, now))
    ? { ok: true }
    : whyNot(db, access, id, now);
}

/** Reads a draft's pictures again as another kind or tab (the officer's one tap in the draft header). */
export async function retype(
  db: Db,
  access: WorkspaceAccess,
  id: number,
  version: number,
  screen: Screen,
  now: Date,
): Promise<SaveResult> {
  const found = await findDraft(db, access.workspaceId, id, now);
  const hook = SAVE_HOOKS[screen.kind];
  if (!found) return { ok: false, code: "gone" };
  if (!hook) return { ok: false, code: "cannot_save" };
  // A tab the officer has not picked yet keeps the draft's guess, still unconfirmed.
  const scoped = SCOPED.includes(screen.kind);
  const scope = scoped ? (screen.scope ?? (found.draft.scope as Scope | null) ?? "weekly") : null;
  const read = hook.read(found.draft.pages, scope, ownTag(access));
  const rows = matched(read.rows, await candidatesOf(db, access, now), hook);
  const sure = !scoped || screen.scope !== null;
  const change = { kind: screen.kind, scope, scopeSure: sure, rows, leftOut: read.leftOut };
  return (await retypeDraft(db, access.workspaceId, id, version, change, now))
    ? { ok: true }
    : whyNot(db, access, id, now);
}
