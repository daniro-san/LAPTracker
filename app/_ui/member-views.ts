// Both rosters of an alliance merged by uid for the member table (plan Phase 5c), with each member's
// ledger rank by might inside the alliance in each roster (Phase 5e), and the member filter's rules:
// sort by one figure, a might range picked on the roster's own steps, a name search.
import { rankBy, rosterDiff } from "@/lib/compute";
import type { MemberRow, Role } from "@/lib/queries";

type Stats = { power: number | null; kills: number | null; lv: number | null };

export interface MemberView {
  uid: number;
  name: string;
  hasAvatar: boolean;
  wasName: string | null;
  status: "joined" | "left" | "";
  before: Stats | null;
  after: Stats | null;
  /** Ledger rank by might inside the alliance, in each roster. */
  rank: { before: number | null; after: number | null };
  /** R5 leader or titled R4 officer, from the roster the member is shown from; null otherwise. */
  role: Role | null;
}

const stat = (m: MemberRow | undefined) =>
  m ? { power: m.power, kills: m.kills, lv: m.lv } : null;

const mightRanks = (roster: MemberRow[]) => rankBy(roster.map((m) => [m.uid, m.power] as const));

/** Both rosters hold members, so they can be compared. An empty one means its phase has not run (or failed). */
export const canCompare = (before: MemberRow[], after: MemberRow[]) =>
  before.length > 0 && after.length > 0;

/** The one roster there is, as the current roster: no joined / left status and no earlier figures. */
function singleRoster(roster: MemberRow[], side: "before" | "after"): MemberView[] {
  const ranks = mightRanks(roster);
  return roster.map((m) => ({
    uid: m.uid,
    name: m.name,
    hasAvatar: m.hasAvatar,
    wasName: null,
    status: "" as const,
    before: side === "before" ? stat(m) : null,
    after: side === "after" ? stat(m) : null,
    role: null,
    rank: {
      before: side === "before" ? (ranks.get(m.uid) ?? null) : null,
      after: side === "after" ? (ranks.get(m.uid) ?? null) : null,
    },
  }));
}

/**
 * Every member of either roster, matched by uid (§3.8): joined, left, or stayed (maybe renamed).
 * With only one roster (the After has not run) nothing is diffed: it is the current roster.
 */
export function memberViews(before: MemberRow[], after: MemberRow[]): MemberView[] {
  if (!canCompare(before, after)) {
    return after.length > 0 ? singleRoster(after, "after") : singleRoster(before, "before");
  }
  const diff = rosterDiff(before, after);
  const [rankBefore, rankAfter] = [mightRanks(before), mightRanks(after)];
  const rank = (uid: number) => ({
    before: rankBefore.get(uid) ?? null,
    after: rankAfter.get(uid) ?? null,
  });
  return [
    ...diff.stayed.map(({ before: b, after: a }) => ({
      uid: a.uid,
      name: a.name,
      hasAvatar: a.hasAvatar,
      wasName: b.name !== a.name ? b.name : null,
      status: "" as const,
      before: stat(b),
      after: stat(a),
      rank: rank(a.uid),
      role: null,
    })),
    ...diff.joined.map((a) => ({
      uid: a.uid,
      name: a.name,
      hasAvatar: a.hasAvatar,
      wasName: null,
      status: "joined" as const,
      before: null,
      after: stat(a),
      rank: rank(a.uid),
      role: null,
    })),
    ...diff.left.map((b) => ({
      uid: b.uid,
      name: b.name,
      hasAvatar: b.hasAvatar,
      wasName: null,
      status: "left" as const,
      before: stat(b),
      after: null,
      rank: rank(b.uid),
      role: null,
    })),
  ];
}

type Roles = ReadonlyMap<number, Role>;

/**
 * Marks each member with the role of the roster they are shown from: the After's, or the Before's for
 * someone who left (or when only the Before exists). A member demoted between the two is unmarked.
 */
export function withRoles(views: MemberView[], before: Roles, after: Roles): MemberView[] {
  return views.map((m) => ({ ...m, role: (m.after ? after : before).get(m.uid) ?? null }));
}

/** The R5 leader first, then the titled officers by might, highest first. */
export function leadership(views: MemberView[]): MemberView[] {
  const leaders = views.filter((m) => m.role?.kind === "leader");
  const officers = views.filter((m) => m.role?.kind === "officer");
  return [...leaders, ...officers.sort((a, b) => mightOf(b) - mightOf(a))];
}

export type SortKey = "might" | "mightDelta" | "kills" | "killsDelta" | "lv" | "name";

export interface MemberFilter {
  sort: SortKey;
  desc: boolean;
  name: string;
  /** Indexes into `mightSteps(members)`: the range's low and high ends. */
  lo: number;
  hi: number;
}

/** A member's might now: the after roster's, or the before roster's for one who left. */
export const mightOf = (m: MemberView) => (m.after ?? m.before)?.power ?? 0;

/** The roster's distinct might values, low to high: the stops of the might range. */
export function mightSteps(members: MemberView[]): number[] {
  return [...new Set(members.map(mightOf))].sort((a, b) => a - b);
}

const gap = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? null : b - a;

/** Changes exist only for members present in both rosters, and only when both snapshots are fresh. */
export function change(
  m: MemberView,
  field: "power" | "kills" | "lv",
  canDelta: boolean,
): number | null {
  return canDelta ? gap(m.before?.[field], m.after?.[field]) : null;
}

function sortValue(m: MemberView, key: SortKey, canDelta: boolean): number | string {
  const now = m.after ?? m.before;
  const values: Record<SortKey, number | string | null | undefined> = {
    might: now?.power,
    mightDelta: change(m, "power", canDelta),
    kills: now?.kills,
    killsDelta: change(m, "kills", canDelta),
    lv: now?.lv,
    name: m.name.toLowerCase(),
  };
  return values[key] ?? (key === "name" ? "" : Number.NEGATIVE_INFINITY);
}

/** The members the filter keeps, in its order. */
export function filterMembers(
  members: MemberView[],
  f: MemberFilter,
  steps: number[],
  canDelta: boolean,
): MemberView[] {
  const [lo, hi] = [steps[f.lo] ?? -Infinity, steps[f.hi] ?? Infinity];
  const text = f.name.trim().toLowerCase();
  const sign = f.desc ? -1 : 1;
  return members
    .filter((m) => mightOf(m) >= lo && mightOf(m) <= hi && m.name.toLowerCase().includes(text))
    .sort((a, b) => {
      const x = sortValue(a, f.sort, canDelta);
      const y = sortValue(b, f.sort, canDelta);
      return x < y ? -sign : x > y ? sign : 0;
    });
}
