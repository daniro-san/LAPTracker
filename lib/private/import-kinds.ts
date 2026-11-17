// The kinds a screenshot import knows and what each one does when saved (issue 299, D96). A kind with a
// save hook (import-save.ts) makes drafts; a kind without one is recognised and reads "coming soon", and
// no draft is made. Event results and Elixir teams (issue 298) plug in by adding a SaveHook. A map is
// recognised only so that it never becomes data: it is not a kind here.
import type { Db } from "../db";
import type { DuelDay } from "../repo/import";
import type { ScreenKind } from "../screenshot/classify";
import type { SecretOpsEntry } from "../screenshot/parse-secret-ops";
import { STATUS_BAR_ASPECT, STATUS_BAR_SHARE } from "../screenshot/prepare";
import type { WorkspaceAccess } from "./access";

export type ImportKind = Exclude<ScreenKind, "map">;
export type Scope = "daily" | "weekly";

/** The kinds whose ranking has a Daily and a Weekly tab. */
export const SCOPED: readonly ImportKind[] = ["alliance_duel", "donation"];

/** The phone status bar the browser drops before sending, by the same rule as the server (prepare.ts). */
export const STATUS_BAR = { share: STATUS_BAR_SHARE, aspect: STATUS_BAR_ASPECT };

/** The member facts a chat picture can update (D80). */
export type PhotoFact = "squadMight" | "adTech";

/** A row read from the pictures, before a person confirms it. */
export interface ReadRow {
  rank: number | null;
  name: string;
  value: number | null;
  flags: string[];
  /** Member update: which fact `value` is. */
  field?: PhotoFact;
  /** Secret Ops report: the entry as the parser read it; `name` is its attacker. */
  entry?: SecretOpsEntry;
}

/** What the pictures were read as: the kind and, for a Daily/Weekly ranking, the tab. */
export interface Screen {
  kind: ImportKind;
  scope: Scope | null;
}

/** A draft as an officer saves it: one value per member, after their fixes. */
export interface Saving {
  screen: Screen;
  pictureDay: string;
  /** Alliance Duel: the Monday of the game week it lands in, and the day (or the whole week). */
  duel: { week: string; day: DuelDay } | null;
  /** One value per member (per member and fact for a member update, with the fact's version seen). */
  rows: {
    uid: number;
    value: number;
    field?: PhotoFact | undefined;
    version?: number | undefined;
  }[];
  /** Secret Ops report: whose report it is, and the entries kept with their attackers as fixed. */
  secretOps: { victimUid: number | null; entries: SecretOpsEntry[] } | null;
  userId: number;
  now: Date;
  /** SERVER_TZ: a report's times are server times. */
  zone: string;
}

/** What a save tells the officer besides "saved": the thefts' counts. */
export interface SaveExtra {
  thefts?: { saved: number; left: { help: number; own: number; duplicate: number } };
}

/**
 * A save the hook refuses after the claim: the transaction rolls back, the draft stays open, and the
 * officer gets `code` (with `detail`: the newer values of a stale member update).
 */
export class SaveRefused extends Error {
  constructor(
    readonly code: "conflict" | "not_in_alliance" | "attacker_missing" | "bad_rows",
    readonly detail: unknown = null,
  ) {
    super(code);
  }
}

/**
 * A kind's reading and saving. `read` turns the pictures' OCR lines (one array per picture) into rows, in
 * order, each once; `own` is the workspace's alliance tag, so rows of other alliances can be left out and
 * counted. `save` writes what the officer confirmed. It runs inside the save's transaction, after the
 * first-save-wins claim, so it runs once per draft; it throws SaveRefused to roll everything back.
 * `matchMembers: false`: the rows' names are not the alliance's members (a report's attackers).
 */
export interface SaveHook {
  read(
    pages: readonly (readonly string[])[],
    scope: Scope | null,
    own: string,
  ): {
    rows: ReadRow[];
    leftOut: number;
  };
  save(db: Db, access: WorkspaceAccess, saving: Saving): Promise<SaveExtra>;
  matchMembers?: false;
}
