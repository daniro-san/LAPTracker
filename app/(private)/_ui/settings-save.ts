// Alliance settings → Features saves on Save (issue 585, F28; D134 amended 2026-11-22): a tick changes only the
// draft; Save sends one POST per switch that differs from what is stored, one after another (the route takes
// one switch and counts one `ws_action` per switch), and stops at the first refusal, keeping the rest.

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
