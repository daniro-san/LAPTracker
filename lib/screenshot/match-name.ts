// Which roster member a name read from a screenshot or a sheet belongs to (D74, issues 297, 299).
// Pure: the candidates, with their name history, are passed in. A name is only `matched` when one
// member fits and no other does; everything less certain is `unsure` (suggestions for a person to
// pick from) or `none`. It never guesses.
import { isNameSegment, nameKey, nameSegments } from "./name-key";

export interface NameCandidate {
  uid: number;
  /** The current name first, then the past names (name history, issue 297). */
  names: readonly string[];
}

export interface NameSuggestion {
  uid: number;
  /** The candidate's name that fits best, as written. */
  name: string;
  distance: number;
}

export type NameMatch =
  | { status: "matched"; uid: number; via: "current" | "past" | "segment" }
  | { status: "unsure"; suggestions: NameSuggestion[] }
  | { status: "none" };

const MAX_SUGGESTIONS = 3;
/** Edits tolerated between two keys; longer names tolerate more. */
const maxDistance = (key: string) => (key.length >= 8 ? 2 : 1);
/** Below this length a key is too short for an approximate match to say anything. */
const MIN_FUZZY_LENGTH = 3;

/** Optimal-string-alignment distance (Damerau-Levenshtein with adjacent swaps), or `limit + 1` past the limit. */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number) => (d[i] as number[])[j] as number;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      let best = Math.min(
        at(i - 1, j) + 1,
        at(i, j - 1) + 1,
        at(i - 1, j - 1) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        best = Math.min(best, at(i - 2, j - 2) + 1);
      (d[i] as number[])[j] = best;
    }
  }
  return at(a.length, b.length);
}

const uniqueUids = (uids: number[]) => [...new Set(uids)];

function suggest(candidates: readonly NameCandidate[], uids: number[]): NameMatch {
  const wanted = new Set(uids);
  const suggestions = candidates
    .filter((c) => wanted.has(c.uid))
    .map((c) => ({ uid: c.uid, name: c.names[0] ?? "", distance: 0 }));
  return { status: "unsure", suggestions: suggestions.slice(0, MAX_SUGGESTIONS) };
}

/** Candidates for which `hit` is true on any of the names of `scope` (all names, or only the current one). */
function uidsWhere(
  candidates: readonly NameCandidate[],
  scope: "current" | "past",
  hit: (name: string) => boolean,
): number[] {
  return uniqueUids(
    candidates
      .filter((c) => (scope === "current" ? c.names.slice(0, 1) : c.names.slice(1)).some(hit))
      .map((c) => c.uid),
  );
}

function fuzzy(key: string, candidates: readonly NameCandidate[]): NameMatch {
  if (key.length < MIN_FUZZY_LENGTH) return { status: "none" };
  const limit = maxDistance(key);
  const best = new Map<number, NameSuggestion>();
  for (const c of candidates) {
    c.names.forEach((name, index) => {
      const other = nameKey(name);
      if (other.length < MIN_FUZZY_LENGTH) return;
      const d = distance(key, other, limit);
      const known = best.get(c.uid);
      if (d <= limit && (!known || d < known.distance || (d === known.distance && index === 0))) {
        best.set(c.uid, { uid: c.uid, name, distance: d });
      }
    });
  }
  const suggestions = [...best.values()]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_SUGGESTIONS);
  return suggestions.length > 0 ? { status: "unsure", suggestions } : { status: "none" };
}

/**
 * Up to `n` candidates nearest to `raw`, however far, for a person to pick from when nothing matched
 * (a "not found" row, a pending member to link, D106): edits between name keys over each candidate's
 * names, nearest first, then by name. Never a match on its own.
 */
export function closestNames(
  raw: string,
  candidates: readonly NameCandidate[],
  n: number,
): NameSuggestion[] {
  const key = nameKey(raw);
  if (key === "") return [];
  return candidates
    .filter((c) => c.names.length > 0)
    .map((c) => {
      const near = c.names.map((name) => {
        const other = nameKey(name);
        return { uid: c.uid, name, distance: distance(key, other, key.length + other.length) };
      });
      return near.reduce((a, b) => (b.distance < a.distance ? b : a));
    })
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
    .slice(0, n);
}

/**
 * Matches `raw` to one candidate: the exact key of a current name, then of a past name, then a name
 * that is one part of a joined name (`Kasoar` for `Kasoar•Thorne`, or the other way round), each
 * only when exactly one member fits. Otherwise names within a few edits are suggested as `unsure`.
 */
export function matchName(raw: string, candidates: readonly NameCandidate[]): NameMatch {
  const key = nameKey(raw);
  if (key === "") return { status: "none" };
  for (const scope of ["current", "past"] as const) {
    const uids = uidsWhere(candidates, scope, (name) => nameKey(name) === key);
    if (uids.length === 1) return { status: "matched", uid: uids[0] as number, via: scope };
    if (uids.length > 1) return suggest(candidates, uids);
  }
  const mine = nameSegments(raw);
  const segmentUids = uniqueUids(
    candidates
      .filter((c) =>
        c.names.some((name) => {
          const theirs = nameSegments(name);
          if (theirs.length > 1 && isNameSegment(key) && theirs.includes(key)) return true;
          return (
            mine.length > 1 &&
            theirs.length === 1 &&
            mine.some((m) => isNameSegment(m) && m === theirs[0])
          );
        }),
      )
      .map((c) => c.uid),
  );
  if (segmentUids.length === 1)
    return { status: "matched", uid: segmentUids[0] as number, via: "segment" };
  if (segmentUids.length > 1) return suggest(candidates, segmentUids);
  return fuzzy(key, candidates);
}
