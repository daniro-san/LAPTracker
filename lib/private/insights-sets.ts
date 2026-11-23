// The members behind an Insights count (#678), pure: a set carries the uids the function that counts them
// returned, so its count is that list's length (one rule per set), and shows them in name order with nothing
// beside a name (D75). Only uid and name: the names come from the page's own read (`InsightsView.people`).
// Each set's key is stable across days (a band, a week's Monday, a zone's offsets), so Members can show the
// same set again from its address (`?set=<kind>:<key>`, D158 rule 7), built by the same function.
import type { InsightsSet } from "../analytics/events";
import { fill, plural } from "../words";
import type { InsightsView } from "./insights";
import type { Formats } from "./insights-format";

/** A member a set holds; `current`: in the newest daily update (else a former member). */
export interface Who {
  uid: number;
  name: string;
  current: boolean;
}

/**
 * The members behind a count: its kind (the analytics `set`), a key unique on the page (the open set's
 * address fragment and Members' `?set=`), its people in name order, the chart's own sentence with the count
 * ("Might 10M – 20M: 4 members"), and "Open these n in Members ›" after its names, or null (a week's
 * leavers: Members lists current members only). Never empty: a count of 0 opens nothing.
 */
export interface MemberSet {
  kind: InsightsSet;
  key: string;
  people: Who[];
  title: string;
  onward: string | null;
}

/** Every kind Members' `?set=` takes, the analytics `InsightsSet` list at run time. */
export const SET_KINDS = [
  "effort_range",
  "effort_left_out",
  "flow_week",
  "tenure",
  "zone",
] as const satisfies readonly InsightsSet[];

/** Up to this many names open in place; more open in the sheet (below 1024 px) or the side pane. */
export const INLINE_MAX = 12;
/** More than this and the count links straight to Members `?set=` (D158 rule 7 (d)). */
export const SHEET_MAX = 60;

export interface SetRef {
  kind: InsightsSet;
  key: string;
}

const REF = new RegExp(`^(${SET_KINDS.join("|")}):([a-z0-9-]{1,48})$`);

/** `?set=` as a reference (a system boundary): an unknown kind or a malformed key is null. */
export function pickSetRef(raw: string | null | undefined): SetRef | null {
  const m = raw ? REF.exec(raw) : null;
  return m ? { kind: m[1] as InsightsSet, key: m[2] as string } : null;
}

export const setRefText = (s: SetRef) => `${s.kind}:${s.key}`;

/** "Might 10M – 20M: 4 members", the chart's own sentence for a set of `n`. */
export const setTitle = (what: string, n: number, { t, language }: Formats) =>
  fill(plural(n, { one: t["drill.title.one"], other: t["drill.title.other"] }, language), {
    what,
    n,
  });

/** "Open these 4 in Members ›". */
const onwardText = (n: number, { t, language }: Formats) =>
  fill(plural(n, { one: t["drill.open.one"], other: t["drill.open.other"] }, language), { n });

/** The set of `uids`, in name order (the page language's collation); null when it holds nobody. */
export function setOf(
  kind: InsightsSet,
  key: string,
  uids: readonly number[],
  people: InsightsView["people"],
  f: Formats & { what: string; onward?: boolean },
): MemberSet | null {
  if (uids.length === 0) return null;
  const order = new Intl.Collator(f.language, { numeric: true, ignorePunctuation: true });
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
    title: setTitle(f.what, uids.length, f),
    onward: (f.onward ?? true) ? onwardText(uids.length, f) : null,
  };
}
