// What the "To review" list and a draft's review screen read (issue 299): the workspace's open drafts,
// and one draft with its rows, the members to pick from, and what is already known to compare with
// (the Alliance Duel points saved for the week, or our own reads for a check). Only the workspace's
// own alliance and drafts (D71).
import type { Db } from "../db";
import {
  countOpenDrafts,
  findDraft,
  newestRoster,
  openDrafts,
  type StoredRow,
} from "../repo/import";
import { closestNames } from "../screenshot/match-name";
import type { WorkspaceAccess } from "./access";
import type { MemberFacts } from "./fact-fields";
import { summaryOf, type DraftSummary } from "./import";
import type { ImportKind, PhotoFact, Scope } from "./import-kinds";
import { canSave, duelSaved, oursFor } from "./import-save";
import { factsOf } from "./member-facts";
import { DAY_MS, gameWeek, isoDay } from "./member-week";
import { pendingMembers } from "./pending-members";

/** The rankings checked against our own reads. */
const CHECKED: ImportKind[] = ["donation", "might", "kills"];

/** Squad might and AD Tech of each member, with their versions. */
function photoFacts(facts: Map<number, MemberFacts>): NonNullable<DraftView["facts"]> {
  const out: NonNullable<DraftView["facts"]> = {};
  for (const [uid, f] of facts) {
    const pick = (field: PhotoFact) => {
      const fact = f[field];
      return fact ? { [field]: { value: fact.value, version: fact.version } } : {};
    };
    out[uid] = { ...pick("squadMight"), ...pick("adTech") };
  }
  return out;
}

export interface ReviewItem extends DraftSummary {
  scopeSure: boolean;
  source: "desk" | "discord" | "pasted";
  sentBy: string | null;
  createdAt: Date;
}

/** The workspace's drafts waiting for review, newest first; expired ones are deleted on the way. */
export async function toReview(db: Db, access: WorkspaceAccess, now: Date): Promise<ReviewItem[]> {
  return (await openDrafts(db, access.workspaceId, now)).map((d) => ({
    id: d.id,
    kind: d.kind as ImportKind,
    scope: d.scope as Scope | null,
    scopeSure: d.scopeSure,
    leftOut: d.leftOut,
    source: d.source,
    sentBy: d.sentBy,
    createdAt: d.createdAt,
    ...summaryOf(d.rows),
  }));
}

export const toReviewCount = (db: Db, access: WorkspaceAccess, now: Date) =>
  countOpenDrafts(db, access.workspaceId, now);

export interface ViewRow extends StoredRow {
  /** The members the matcher suggests for a doubtful row; for a row not found, the closest names. */
  suggestions: { uid: number; name: string }[];
}

/** Closest names offered on a row not found (D106). */
const CLOSEST = 3;

/** Saved Alliance Duel points of one member for a week: `week` and `mon` … `sat`. */
export type DuelSaved = Partial<Record<string, number>>;

export interface DraftView {
  id: number;
  kind: ImportKind;
  scope: Scope | null;
  scopeSure: boolean;
  status: "open" | "saved" | "discarded";
  version: number;
  doneBy: string | null;
  source: "desk" | "discord" | "pasted";
  sentBy: string | null;
  createdAt: Date;
  expiresAt: Date;
  pictureDay: string;
  /** The game week of the picture, Monday to Sunday. */
  week: string[];
  pages: number;
  leftOut: number;
  canSave: boolean;
  rows: ViewRow[];
  /** The alliance's members, by name: the officer may give any row any member. */
  members: { uid: number; name: string }[];
  /** New members added by hand, waiting for the roster (D106): a row may go to one of them too. */
  pending: { uid: number; name: string }[];
  /** Alliance Duel: what is saved for the picture's week and the week before, per member. */
  duel: { thisWeek: Record<number, DuelSaved>; weekBefore: Record<number, DuelSaved> } | null;
  /** A check: our own value per member for the picture's day or week (null: no data, D75). */
  ours: Record<number, number | null> | null;
  /** Member update: each member's squad might and AD Tech now, with the version a save is based on (D80). */
  facts: Record<
    number,
    Partial<Record<PhotoFact, { value: number | null; version: number }>>
  > | null;
  /** Secret Ops report: the member it is preselected for, the officer's "This is me" player when set. */
  victim: number | null;
}

/**
 * A doubtful row's suggestions, as the matcher made them; a row not found gets the closest names to what
 * was read, so the picker starts with them (D106). A matched row needs none.
 */
function suggestionsOf(row: StoredRow, roster: { uid: number; name: string }[]) {
  const names = new Map(roster.map((m) => [m.uid, m.name]));
  if (row.match.status === "doubtful")
    return row.match.uids.map((uid) => ({ uid, name: names.get(uid) ?? "" }));
  if (row.match.status === "sure") return [];
  const candidates = roster.map((m) => ({ uid: m.uid, names: [m.name] }));
  return closestNames(row.name, candidates, CLOSEST).map(({ uid, name }) => ({ uid, name }));
}

/** One draft of the workspace, ready for the review screen; null when it is not there (or expired). */
export async function draftView(
  db: Db,
  access: WorkspaceAccess,
  id: number,
  now: Date,
): Promise<DraftView | null> {
  const found = await findDraft(db, access.workspaceId, id, now);
  if (!found) return null;
  const d = found.draft;
  const kind = d.kind as ImportKind;
  const scope = d.scope as Scope | null;
  const roster = await newestRoster(db, access.unionId);
  const week = gameWeek(d.pictureDay);
  const monday = week[0] as string;
  const [duel, ours] = await Promise.all([
    kind === "alliance_duel"
      ? Promise.all([
          duelSaved(db, access, monday),
          duelSaved(db, access, isoDay(Date.parse(`${monday}T00:00:00Z`) - 7 * DAY_MS)),
        ])
      : null,
    CHECKED.includes(kind) ? oursFor(db, access, { kind, scope }, d.pictureDay) : null,
  ]);
  return {
    id: d.id,
    kind,
    scope,
    scopeSure: d.scopeSure,
    status: d.status,
    version: d.version,
    doneBy: found.doneByName,
    source: d.source,
    sentBy: d.sentBy,
    createdAt: d.createdAt,
    expiresAt: d.expiresAt,
    pictureDay: d.pictureDay,
    week,
    pages: d.pages.length,
    leftOut: d.leftOut,
    canSave: canSave(kind),
    rows: d.rows.map((row) => ({
      ...row,
      suggestions: suggestionsOf(row, roster),
    })),
    members: roster
      .map((m) => ({ uid: m.uid, name: m.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    pending: (await pendingMembers(db, access)).map((p) => ({ uid: p.uid, name: p.name })),
    duel: duel && {
      thisWeek: Object.fromEntries(duel[0]),
      weekBefore: Object.fromEntries(duel[1]),
    },
    ours: ours && Object.fromEntries(ours),
    facts: kind === "member_update" ? photoFacts(await factsOf(db, access)) : null,
    victim:
      kind === "secret_ops" && roster.some((m) => m.uid === access.user.playerUid)
        ? access.user.playerUid
        : null,
  };
}
