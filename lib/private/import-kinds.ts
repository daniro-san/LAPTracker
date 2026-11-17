// The kinds a screenshot import knows and what each one does when saved (issue 299, D96). A kind with a
// save hook (import-save.ts) makes drafts; a kind without one is recognised and reads "coming soon", and
// no draft is made. The sessions that own a destination plug in by adding a SaveHook for their kind:
// event results and Elixir teams (issue 298), thefts (issue 321), member updates (issue 297). A map is
// recognised only so that it never becomes data: it is not a kind here.
import type { Db } from "../db";
import type { DuelDay } from "../repo/import";
import type { ScreenKind } from "../screenshot/classify";
import type { WorkspaceAccess } from "./access";

export type ImportKind = Exclude<ScreenKind, "map">;
export type Scope = "daily" | "weekly";

/** The kinds whose ranking has a Daily and a Weekly tab. */
export const SCOPED: readonly ImportKind[] = ["alliance_duel", "donation"];

/** A row read from the pictures, before a person confirms it. */
export interface ReadRow {
  rank: number | null;
  name: string;
  value: number | null;
  flags: string[];
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
  rows: { uid: number; value: number }[];
  userId: number;
  now: Date;
}

/**
 * A kind's reading and saving. `read` turns the pictures' OCR lines (one array per picture) into rows, in
 * order, each once; `own` is the workspace's alliance tag, so rows of other alliances can be left out and
 * counted. `save` writes what the officer confirmed. It runs inside the save's transaction, after the
 * first-save-wins claim, so it runs once per draft. A hook for member updates must also show the member's
 * previous value next to the read one (issue 297), which the review screen gets per kind.
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
  save(db: Db, access: WorkspaceAccess, saving: Saving): Promise<void>;
}
