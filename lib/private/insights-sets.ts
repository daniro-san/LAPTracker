// The members behind an Insights count (#678), pure: a set carries the uids the function that counts them
// returned, so its count is that list's length (one rule per set), and shows them in name order with nothing
// beside a name (D75). Only uid and name: the names come from the page's own read (`InsightsView.people`).
import type { InsightsSet } from "../analytics/events";
import type { InsightsView } from "./insights";

/** A member a set holds; `current`: in the newest daily update (else a former member). */
export interface Who {
  uid: number;
  name: string;
  current: boolean;
}

/**
 * The members behind a count: its kind (the analytics `set`), a key unique on the page (the open set's
 * address fragment) and its people in name order. Never empty: a count of 0 opens nothing.
 */
export interface MemberSet {
  kind: InsightsSet;
  key: string;
  people: Who[];
}

/** The set of `uids`, in name order (the page language's collation); null when it holds nobody. */
export function setOf(
  kind: InsightsSet,
  key: string,
  uids: readonly number[],
  people: InsightsView["people"],
  language: string,
): MemberSet | null {
  if (uids.length === 0) return null;
  const order = new Intl.Collator(language, { numeric: true, ignorePunctuation: true });
  return {
    kind,
    key,
    people: uids
      .map((uid) => ({
        uid,
        name: people.get(uid)?.name ?? String(uid),
        current: people.get(uid)?.current ?? false,
      }))
      .sort((a, b) => order.compare(a.name, b.name)),
  };
}
