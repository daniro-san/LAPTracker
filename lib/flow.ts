// Member flow between tracked alliances (D89, #275). Pure: the alliance each member was in on two days in,
// counts per (source, destination) out. No IO, no names, no member list leaves this module: a cell is a
// number. Cells under FLOW_MIN are dropped before anything is shown.

/**
 * A cell of 1-4 members identifies people through their player pages, so no cell under this many is
 * shown, and no destination under it is listed (adversarial review 2026-11-16, D89).
 */
export const FLOW_MIN = 5;

/** One alliance's usable daily roster of a day: when it was read and the uids in it. */
export interface DayRoster {
  unionId: number;
  at: number;
  uids: readonly number[];
}

/**
 * A member's alliance on a day: the alliance whose roster that day lists the uid. A uid in two rosters
 * (the reads are seconds apart, so a move can land between them) goes to the roster read later; the
 * lower union id breaks a tie.
 */
export function placeMembers(rosters: readonly DayRoster[]): Map<number, number> {
  const placed = new Map<number, DayRoster>();
  for (const r of rosters) {
    for (const uid of r.uids) {
      const have = placed.get(uid);
      if (!have || r.at > have.at || (r.at === have.at && r.unionId < have.unionId)) {
        placed.set(uid, r);
      }
    }
  }
  return new Map([...placed].map(([uid, r]) => [uid, r.unionId]));
}

/**
 * `n` members were in `from` on the start day and in `to` on the end day. `from` null: not in a counted
 * alliance on the start day ("new to the 20"); `to` null: not in one on the end day ("left the 20");
 * `from === to`: stayed.
 */
export interface FlowCell {
  from: number | null;
  to: number | null;
  n: number;
}

/**
 * Every (source, destination) count between two placements. Only alliances in `ids` count as an
 * alliance; a member placed elsewhere is outside the 20 on that day. A member outside on both days is
 * not counted. Cells are all of them, small ones included: hide with `visibleCells`.
 */
export function buildFlow(
  start: ReadonlyMap<number, number>,
  end: ReadonlyMap<number, number>,
  ids: readonly number[],
): FlowCell[] {
  const counted = new Set(ids);
  const side = (m: ReadonlyMap<number, number>, uid: number) => {
    const unionId = m.get(uid);
    return unionId !== undefined && counted.has(unionId) ? unionId : null;
  };
  const cells = new Map<string, FlowCell>();
  for (const uid of new Set([...start.keys(), ...end.keys()])) {
    const [from, to] = [side(start, uid), side(end, uid)];
    if (from === null && to === null) continue;
    const key = `${from}>${to}`;
    const cell = cells.get(key);
    if (cell) cell.n += 1;
    else cells.set(key, { from, to, n: 1 });
  }
  return [...cells.values()];
}

/** The cells a page may show: at least `min` members. */
export const visibleCells = (cells: readonly FlowCell[], min: number = FLOW_MIN): FlowCell[] =>
  cells.filter((c) => c.n >= min);

export interface FlowSummary {
  /** Members in one counted alliance on the start day and another on the end day. */
  moved: number;
  /** Members in a counted alliance on the end day only / on the start day only. */
  arrived: number;
  left: number;
  /** The biggest move between two alliances that is big enough to show; null when none is. */
  largest: FlowCell | null;
}

/** A move between two different counted alliances. */
type Move = FlowCell & { from: number; to: number };
const isMove = (c: FlowCell): c is Move => c.from !== null && c.to !== null && c.from !== c.to;
const total = (cells: readonly FlowCell[]) => cells.reduce((sum, c) => sum + c.n, 0);

export function summarise(cells: readonly FlowCell[], min: number = FLOW_MIN): FlowSummary {
  const moves = cells.filter(isMove);
  // The biggest first; the lower source, then the lower destination, breaks a tie.
  const [largest = null] = moves
    .filter((c) => c.n >= min)
    .sort((p, q) => q.n - p.n || p.from - q.from || p.to - q.to);
  return {
    moved: total(moves),
    arrived: total(cells.filter((c) => c.from === null)),
    left: total(cells.filter((c) => c.from !== null && c.to === null)),
    largest,
  };
}

/** The counted alliances, the ones with the most moves in or out first, then by union id. */
export function activityOrder(cells: readonly FlowCell[], ids: readonly number[]): number[] {
  const activity = new Map(ids.map((id) => [id, 0]));
  for (const c of cells) {
    if (c.from === c.to) continue;
    if (c.from !== null) activity.set(c.from, (activity.get(c.from) ?? 0) + c.n);
    if (c.to !== null) activity.set(c.to, (activity.get(c.to) ?? 0) + c.n);
  }
  return [...ids].sort((p, q) => (activity.get(q) ?? 0) - (activity.get(p) ?? 0) || p - q);
}
