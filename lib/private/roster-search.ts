// "This is me" search (issue 334): the officer types part of their game name and the alliance's newest roster
// is filtered as they type, in the browser. Names are compared by their name key (D74), so case, accents,
// emoji and decoration do not matter. Pure: it imports only the key.
import { nameKey } from "../screenshot/name-key";

export const SEARCH_ROWS = 6;

/** Members whose name key contains the query's key, in roster order, at most SEARCH_ROWS; none for an empty key. */
export function searchRoster<T extends { name: string }>(query: string, roster: readonly T[]): T[] {
  const key = nameKey(query);
  if (key === "") return [];
  return roster.filter((p) => nameKey(p.name).includes(key)).slice(0, SEARCH_ROWS);
}
