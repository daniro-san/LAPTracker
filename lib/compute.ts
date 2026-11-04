// Pure functions only: sums, deltas, freshness predicate, roster diff. No IO, no Date.now() (passed in).

/** Roster kills. A member with `kills: null` counts as 0 (DECISIONS D15). */
export function sumKills(members: readonly { kills: number | null }[]): number {
  return members.reduce((total, m) => total + (m.kills ?? 0), 0);
}
