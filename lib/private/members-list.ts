// The Members tab's filters (issue #296), pure: which filters keep a member, how many each keeps, and the
// members a filter and a name search keep. The page applies them on the server, from ?f= and ?q=.
import type { MemberRow } from "./members";

export const MEMBER_FILTERS = ["all", "new", "checkin", "missing", "r4"] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];

/** The filters, other than All, that keep this member. */
export function filtersOf(m: MemberRow): MemberFilter[] {
  return [
    ...(m.isNew ? (["new"] as const) : []),
    // A status an officer set shows instead of Check in (#297), so it leaves this filter too.
    ...(m.reasons.length > 0 && m.officerStatus === null ? (["checkin"] as const) : []),
    ...(m.missing.length > 0 ? (["missing"] as const) : []),
    ...((m.rankCode ?? 0) >= 104 ? (["r4"] as const) : []),
  ];
}

/** `?f=` as a filter; anything else is All. */
export const pickFilter = (raw: unknown): MemberFilter =>
  MEMBER_FILTERS.find((f) => f === raw) ?? "all";

/** Lower case without accents, so "laeti" finds "Laëti38". */
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();

const keeps = (m: MemberRow, filter: MemberFilter) =>
  filter === "all" || filtersOf(m).includes(filter);

/** The members `filter` keeps whose name holds `query`, in their order. */
export function keepMembers(rows: MemberRow[], filter: MemberFilter, query: string): MemberRow[] {
  const needle = fold(query.trim());
  return rows.filter((m) => keeps(m, filter) && fold(m.name).includes(needle));
}

/** How many members each filter keeps (the search is not applied). */
export function filterCounts(rows: MemberRow[]): Record<MemberFilter, number> {
  return Object.fromEntries(
    MEMBER_FILTERS.map((f) => [f, rows.filter((m) => keeps(m, f)).length]),
  ) as Record<MemberFilter, number>;
}
