// The KvK matchup's rules (D152, issue 306), pure: which alliances each side compares, their figures at the
// Start, and Start to End over the members in both readings. No IO, no clock.

/** A KvK opponent's Start row the End and the matchup may use: data, fresh, and read before the war. */
export const usableStart = (
  r: {
    phase: string;
    error: string | null;
    unionId: number | null;
    isFresh: boolean;
    readAt: Date;
  },
  warAt: Date,
) =>
  r.phase === "before" && r.error === null && r.unionId !== null && r.isFresh && r.readAt < warAt;

/** Members with at least this might at the Start are counted on each side (the issue's table). */
export const HEAVY_MIGHT = 60_000_000;
/** "Kills per 1B might". */
const BILLION = 1_000_000_000;

/** One alliance's figures at the Start, and from Start to End over its members in both readings. */
export interface SideAlliance {
  unionId: number;
  tag: string | null;
  name: string | null;
  might: number;
  kills: number;
  /** Members at the Start, and those with a non-null might of at least HEAVY_MIGHT. */
  members: number;
  heavy: number;
  /** When the Start reading was made. */
  readAt: Date;
  /** Null until a usable End: no End, or one that is stale or failed (no change shown, REVIEW item 1). */
  change: MemberChange | null;
}

/** Start to End over the members in both readings; a member's null figure is left out of that figure. */
export interface MemberChange {
  might: number;
  kills: number;
  /** The members in both readings. */
  members: number;
}

export interface Side {
  /** The top n by Start might, biggest first. */
  alliances: SideAlliance[];
  might: number;
  kills: number;
  /** Σ kills / Σ might × 1B over the same alliances; null with no might. */
  killsPer1B: number | null;
  members: number;
  heavy: number;
  /** The newest Start reading of the side. */
  readAt: Date;
  /** Start to End: the side's n alliances with a usable End, null before the End. */
  change: { counted: number; might: number; kills: number; members: number } | null;
}

export interface Matchup {
  n: number;
  us: Side;
  them: Side;
}

/** Start to End of one alliance over its members in both readings (the D69 amendment's rule, D83's for kills):
 * a member left or joined is not counted; a null figure in either reading leaves that member out of it; a
 * fall in kills counts as none. */
export function memberChange(
  start: {
    uids: readonly number[];
    might: readonly (number | null)[];
    kills: readonly (number | null)[];
  },
  end: {
    uids: readonly number[];
    might: readonly (number | null)[];
    kills: readonly (number | null)[];
  },
): MemberChange {
  const at = new Map(end.uids.map((uid, i) => [uid, i]));
  let might = 0;
  let kills = 0;
  let members = 0;
  start.uids.forEach((uid, i) => {
    const j = at.get(uid);
    if (j === undefined) return;
    members++;
    const [m0, m1, k0, k1] = [start.might[i], end.might[j], start.kills[i], end.kills[j]];
    if (m0 != null && m1 != null) might += m1 - m0;
    if (k0 != null && k1 != null) kills += Math.max(k1 - k0, 0);
  });
  return { might, kills, members };
}

/** Members at the Start with a known might of at least HEAVY_MIGHT. */
export const heavyCount = (might: readonly (number | null)[]) =>
  might.filter((m) => m !== null && m >= HEAVY_MIGHT).length;

const sum = (xs: readonly number[]) => xs.reduce((t, x) => t + x, 0);
const byMight = (a: SideAlliance, b: SideAlliance) => b.might - a.might || a.unionId - b.unionId;

function sideOf(top: SideAlliance[], ended: boolean): Side {
  const might = sum(top.map((a) => a.might));
  const kills = sum(top.map((a) => a.kills));
  const counted = top.flatMap((a) => (a.change ? [a.change] : []));
  return {
    alliances: top,
    might,
    kills,
    killsPer1B: might > 0 ? (kills / might) * BILLION : null,
    members: sum(top.map((a) => a.members)),
    heavy: sum(top.map((a) => a.heavy)),
    readAt: new Date(Math.max(...top.map((a) => a.readAt.getTime()))),
    change: ended
      ? {
          counted: counted.length,
          might: sum(counted.map((c) => c.might)),
          kills: sum(counted.map((c) => c.kills)),
          members: sum(counted.map((c) => c.members)),
        }
      : null,
  };
}

/**
 * Both sides' top n by Start might, n the smaller count of usable Start readings, so the two sums cover as many
 * alliances each. The set is fixed at the Start: Start to End covers the same n, never re-ranked at the End.
 * `ours` and `theirs` hold only usable Start readings. Null when either side has none.
 */
export function matchupOf(
  ours: readonly SideAlliance[],
  theirs: readonly SideAlliance[],
  ended: boolean,
): Matchup | null {
  const n = Math.min(ours.length, theirs.length);
  if (n === 0) return null;
  const top = (xs: readonly SideAlliance[]) => [...xs].sort(byMight).slice(0, n);
  return { n, us: sideOf(top(ours), ended), them: sideOf(top(theirs), ended) };
}
