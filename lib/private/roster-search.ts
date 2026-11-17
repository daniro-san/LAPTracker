// "This is me" search (issue 334): the officer types part of their game name and the alliance's newest roster
// is filtered as they type, in the browser. Names are compared by their name key (D74), so case, accents,
// emoji and decoration do not matter. Pure: it imports only the key and the closest-names ranking.
import { closestNames } from "../screenshot/match-name";
import { nameKey } from "../screenshot/name-key";

export const SEARCH_ROWS = 6;

/** Members whose name key contains the query's key, in roster order, at most SEARCH_ROWS; none for an empty key. */
export function searchRoster<T extends { name: string }>(query: string, roster: readonly T[]): T[] {
  const key = nameKey(query);
  if (key === "") return [];
  return roster.filter((p) => nameKey(p.name).includes(key)).slice(0, SEARCH_ROWS);
}

/** The members whose name has `name`'s key: a new member's name that is already a member's (D106). */
export function sameName<T extends { name: string }>(name: string, roster: readonly T[]): T[] {
  const key = nameKey(name);
  return key === "" ? [] : roster.filter((m) => nameKey(m.name) === key);
}

/** The `n` members whose names are nearest to `name` (D106's "Link to a member"), then the rest by name. */
export function closestFirst<T extends { uid: number; name: string }>(
  name: string,
  roster: readonly T[],
  n: number,
): { closest: T[]; others: T[] } {
  const byUid = new Map(roster.map((m) => [m.uid, m]));
  const near = closestNames(
    name,
    roster.map((m) => ({ uid: m.uid, names: [m.name] })),
    n,
  ).map((c) => byUid.get(c.uid) as T);
  const others = roster
    .filter((m) => !near.includes(m))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { closest: near, others };
}
