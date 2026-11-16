// The officers' first-use cards (issue #312), as data. The persona panel of 2026-11-16 chose three static
// cards: what this is, where the numbers come from, each week. The cards open once by themselves; "?"
// shows them again in a sheet that does not block the page, with Replay.
import type { WorkspaceKey } from "./dictionary";

export interface FirstUseStep {
  title: WorkspaceKey;
  /** Paragraphs, in order. */
  body: WorkspaceKey[];
  /** What the card shows under its first paragraph: the "R4 · R5 only" badge or the three source labels. */
  visual?: "only" | "sources";
}

export const FIRST_USE_STEPS: readonly FirstUseStep[] = [
  { title: "intro.1.title", body: ["intro.1.body"], visual: "only" },
  { title: "intro.2.title", body: ["intro.2.body", "intro.2.more"], visual: "sources" },
  { title: "intro.3.title", body: ["intro.3.body", "intro.3.more", "intro.3.last"] },
];

/** Where a number comes from, and the label it carries. */
export const SOURCES = [
  { source: "game", key: "src.game" },
  { source: "photo", key: "src.photo" },
  { source: "officer", key: "src.officer" },
] as const satisfies readonly { source: string; key: WorkspaceKey }[];
