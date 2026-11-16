// The officers' first-use steps (issue #312), as data: the format that shows them (cards today; motion,
// a coach-mark tour or per-tab tips are under review) reads this list and nothing else.
import type { WorkspaceKey } from "./dictionary";

export interface FirstUseStep {
  title: WorkspaceKey;
  /** Paragraphs, in order. */
  body: WorkspaceKey[];
  /** What the step shows under its text: the three source labels, or the link to the how-to page. */
  visual?: "sources" | "how-to";
  /** The element a coach mark would point at; nothing reads it yet. */
  target?: string;
}

export const FIRST_USE_STEPS: readonly FirstUseStep[] = [
  { title: "intro.1.title", body: ["intro.1.body"] },
  { title: "intro.2.title", body: ["intro.2.body", "intro.2.more"], visual: "sources" },
  {
    title: "intro.3.title",
    body: ["intro.3.body", "intro.3.more"],
    target: '[data-tour="members-tab"]',
  },
  {
    title: "intro.4.title",
    body: ["intro.4.body", "intro.4.more"],
    visual: "how-to",
    target: '[data-tour="language"]',
  },
];

/** Where a number comes from, and the label it carries. */
export const SOURCES = [
  { source: "game", key: "src.game" },
  { source: "photo", key: "src.photo" },
  { source: "officer", key: "src.officer" },
] as const satisfies readonly { source: string; key: WorkspaceKey }[];
