// Alliance settings → Features saves on Save (issue 585, F28; D134 amended 2026-11-22): a tick changes only the
// draft; Save sends one POST per switch that differs from what is stored, one after another (the route takes
// one switch and counts one `ws_action` per switch), and stops at the first refusal, keeping the rest.
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import { fill } from "@/lib/words";

export interface SwitchChange {
  feature: string;
  on: boolean;
}

/** One switch sent: `saved` is the value stored, or null when refused; `code` the refusal ("failed": no answer). */
export type SwitchPost = (
  change: SwitchChange,
) => Promise<{ saved: boolean | null; code: string | null }>;

/** The switches whose draft differs from what is stored, in the stored order. */
export function featureChanges(
  stored: Record<string, boolean>,
  draft: Record<string, boolean>,
): SwitchChange[] {
  return Object.keys(stored)
    .filter((feature) => feature in draft && draft[feature] !== stored[feature])
    .map((feature) => ({ feature, on: draft[feature] as boolean }));
}

/** Sends the changes in order; on a refusal, its code and the changes from that one on, unsent. */
export async function sendChanges(
  changes: SwitchChange[],
  post: SwitchPost,
): Promise<{ code: string | null; unsent: SwitchChange[] }> {
  for (const [i, change] of changes.entries()) {
    const { saved, code } = await post(change);
    if (saved === null) return { code: code ?? "failed", unsent: changes.slice(i) };
  }
  return { code: null, unsent: [] };
}

type Switches = Record<string, boolean>;

/**
 * The card's bookkeeping after a Save. `through`: the switches stored so far (earlier saves' too), shown until
 * the refreshed page brings them. `draft`: the switches not sent, still "Not saved yet"; a switch the owner
 * no longer allows (`not_allowed`) is dropped, since the refreshed page leaves it out.
 */
export function afterSave(
  changes: SwitchChange[],
  result: { code: string | null; unsent: SwitchChange[] },
  through: Switches,
): { through: Switches; draft: Switches } {
  const done = changes.slice(0, changes.length - result.unsent.length);
  const kept = result.code === "not_allowed" ? result.unsent.slice(1) : result.unsent;
  return {
    through: { ...through, ...Object.fromEntries(done.map((c) => [c.feature, c.on])) },
    draft: Object.fromEntries(kept.map((c) => [c.feature, c.on])),
  };
}

/** A box shows the officer's draft first, then what a Save just stored, then what the page read. */
export function shownOn(feature: string, read: boolean, draft: Switches, through: Switches) {
  return draft[feature] ?? through[feature] ?? read;
}

/** The words for a refusal other than signed out; `stoppedAt` is the switch Save stopped at. */
export function refusalWords(
  code: string,
  stoppedAt: SwitchChange | undefined,
  t: WorkspaceDictionary,
): string {
  if (code === "rate_limited") return t["switches.rateLimited"];
  if (code === "not_allowed" && stoppedAt) {
    const key = `switches.name.${stoppedAt.feature}` as WorkspaceKey;
    return fill(t["switches.notAllowed"], { name: t[key] ?? stoppedAt.feature });
  }
  return t["switches.failed"];
}
