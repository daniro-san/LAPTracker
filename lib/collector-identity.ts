// The identity check of a roster read (D69 amendment, 2026-11-21). The upstream sometimes answers a read of
// alliance X with another alliance's roster under X's own id: another tag, another name and other members.
// Split from lib/collector.ts for its size.
import { IdentityError, type AllianceSnapshotInput, type RanksBoard } from "./sources/types";

/** Below this share of the smaller list in common, two rosters are two alliances. Event 263: every good
 * sample row shared 93 % or more of its uids with the alliance's earlier reading, each wrong one 0 %. */
export const SAME_ROSTER_MIN = 0.2;

/** Whether `read` shares at least SAME_ROSTER_MIN of the smaller list with `known`. */
export function sameMembers(read: readonly number[], known: readonly number[]): boolean {
  const set = new Set(known);
  const common = read.filter((uid) => set.has(uid)).length;
  return common > 0 && common >= SAME_ROSTER_MIN * Math.min(read.length, known.length);
}

type Label = { tag: string | null; name: string | null };

/**
 * INVARIANT collector.identity-checked: no roster of another alliance is stored as X's.
 * Throws IdentityError when `a`, read for `unionId`, is another alliance: another id (`id`), or a tag and a
 * name that both differ from X's previous good reading (the board's label, and X's newest label) with
 * almost none of the members of X's newest daily roster (`rosters`, loaded once per run) (`tag`). A rename
 * keeps its members and passes; with no known label or no daily roster it passes. A code only, never a tag
 * or name.
 */
export function checkIdentity(
  run: {
    board: RanksBoard | null;
    labels: ReadonlyMap<number, Label>;
    rosters: ReadonlyMap<number, readonly number[]>;
  },
  unionId: number,
  a: AllianceSnapshotInput,
): void {
  if (a.unionId !== unionId) throw new IdentityError("id");
  const known = [run.board?.labels.get(unionId), run.labels.get(unionId)].filter(
    (l): l is Label => l !== undefined && (l.tag !== null || l.name !== null),
  );
  const same = (mine: string | null, theirs: string) => mine !== null && mine === theirs;
  if (known.length === 0 || known.some((l) => same(l.tag, a.tag) || same(l.name, a.name))) return;
  // No daily roster yet: nothing to compare the members with, so the read passes.
  const own = run.rosters.get(unionId);
  if (!own) return;
  if (
    !sameMembers(
      a.members.map((m) => m.uid),
      own,
    )
  )
    throw new IdentityError("tag");
}
