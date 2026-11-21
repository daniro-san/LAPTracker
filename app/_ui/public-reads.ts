// The public pages' reads that every viewer shares until the next write (D143): each goes through
// AppContext.publicCache under the `reads` tag. Each load opens its own connection (withOwnDb), never the
// request's: Next re-reads an expired entry in the background, after the request's Pool is closed. Only
// rows go in; what depends on `now` (the home event, the banner's "down") is computed per request.
import { getAppContext } from "@/lib/app-context";
import type { Db } from "@/lib/db";
import { withOwnDb } from "@/lib/page";
import { listEvents, upstreamRows } from "@/lib/queries";
import { allianceList, eventAllianceIds } from "@/lib/queries/alliance-list";
import { searchPlayers } from "@/lib/queries/players";

/** `load`'s value under `name` and `key`, shared by every viewer until the next write. */
export const sharedRead = <T>(
  name: string,
  key: readonly (string | number | boolean | null)[],
  load: (db: Db) => Promise<T>,
) => getAppContext().publicCache.read(name, key, () => withOwnDb(load));

/** The public events with their phase rows: every page's header and the home event's input. */
export const sharedEvents = () => sharedRead("events", [], listEvents);

/** /alliances: the newest board, one page of it. Kept under the page it shows (`asked` clamped to the pages
 * there are, from page 1's entry), so a made-up `?page=` adds no entry. */
export async function sharedAllianceList(asked: number) {
  const first = await sharedRead("alliance-list", [1], (db) => allianceList(db, 1));
  const page = Math.min(Math.max(1, asked), first.pages);
  return page === 1 ? first : sharedRead("alliance-list", [page], (db) => allianceList(db, page));
}

/** The alliances an event read: which list rows link into it. */
export const sharedEventAllianceIds = (eventId: number) =>
  sharedRead("event-alliances", [eventId], (db) => eventAllianceIds(db, eventId));

/** /players?q=: the matches for one search text. */
export const sharedPlayerSearch = (q: string) =>
  sharedRead("player-search", [q], (db) => searchPlayers(db, q));

/** The upstream banner's rows; "down" is computed from them per request (upstreamStatusOf). */
export const sharedUpstreamRows = () => sharedRead("upstream", [], upstreamRows);
