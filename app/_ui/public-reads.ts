// The public pages' reads that every viewer shares until the next write (D143): each goes through
// AppContext.publicCache under the `reads` tag. Each load opens its own connection (withOwnDb), never the
// request's: Next re-reads an expired entry in the background, after the request's Pool is closed. Only
// rows go in; what depends on `now` (the home event, the banner's "down") is computed per request.
import { getAppContext } from "@/lib/app-context";
import type { Db } from "@/lib/db";
import { withOwnDb } from "@/lib/page";
import {
  listEvents,
  playerHistory,
  playerProgress,
  recruitingAlliances,
  upstreamRows,
} from "@/lib/queries";
import { allianceList, allianceOnBoard, eventAllianceIds } from "@/lib/queries/alliance-list";
import { sampledEventIds } from "@/lib/queries/fight-clock";
import { allianceNames } from "@/lib/queries/names";
import { searchPlayers } from "@/lib/queries/player-search";

/** `load`'s value under `name` and `key`, shared by every viewer until the next write. */
export const sharedRead = <T>(
  name: string,
  key: readonly (string | number | boolean | null)[],
  load: (db: Db) => Promise<T>,
) => getAppContext().publicCache.read(name, key, () => withOwnDb(load));

/** The public events with their phase rows: every page's header and the home event's input. `sampled`: the
 * event has a 15-minute reading, so the header lists the fight clock (issue 473). A sample's run
 * invalidates `reads` (lib/run.ts), so the first sample shows on the next view. */
export const sharedEvents = () =>
  sharedRead("events", [], async (db) => {
    const [list, sampled] = await Promise.all([listEvents(db), sampledEventIds(db)]);
    return list.map((e) => ({ ...e, sampled: sampled.has(e.id) }));
  });

/** /alliances: the newest board, one page of it. Kept under the page it shows (`asked` clamped to the pages
 * there are, from page 1's entry), so a made-up `?page=` adds no entry. */
export async function sharedAllianceList(asked: number) {
  const first = await sharedRead("alliance-list", [1], (db) => allianceList(db, 1));
  const page = Math.min(Math.max(1, asked), first.pages);
  return page === 1 ? first : sharedRead("alliance-list", [page], (db) => allianceList(db, page));
}

/** /alliances' "Alliances recruiting" (issue 792), keyed by the server day: a new day drops the reads that
 * went stale. The daily read and the details lookup write `daily_rosters` and invalidate `reads`. */
export const sharedRecruiting = (today: string) =>
  sharedRead("recruiting", [today], (db) => recruitingAlliances(db, today));

/** The alliances an event read: which list rows link into it. */
export const sharedEventAllianceIds = (eventId: number) =>
  sharedRead("event-alliances", [eventId], (db) => eventAllianceIds(db, eventId));

/** /players?q=: the matches for one search text. */
/** Each alliance an event read with its newest tag and name: a fight-clock slot's split names them. */
export const sharedEventAllianceLabels = (eventId: number) =>
  sharedRead("event-alliance-labels", [eventId], async (db) => {
    const names = await allianceNames(db, await eventAllianceIds(db, eventId));
    return [...names].flatMap(([id, list]) => {
      const last = list.at(-1);
      return last ? [{ id, tag: last.tag, name: last.name }] : [];
    });
  });

export const sharedPlayerSearch = (q: string) =>
  sharedRead("player-search", [q], (db) => searchPlayers(db, q));

/** A player page's reads: the history and the progress; null (never kept) for an unknown uid. Its link
 * preview card reads the same entry (issue 830). */
export const sharedPlayer = (uid: number) =>
  sharedRead("player", [uid], async (db) => {
    const history = await playerHistory(db, uid);
    return history && { history, progress: await playerProgress(db, uid) };
  });

/** An alliance page's link preview card (issue 830): its newest tag and name and its ranks board row; null
 * (never kept) for an alliance with neither. */
export const sharedAllianceCard = (unionId: number) =>
  sharedRead("alliance-card", [unionId], async (db) => {
    const [board, names] = await Promise.all([
      allianceOnBoard(db, unionId),
      allianceNames(db, [unionId]),
    ]);
    const last = names.get(unionId)?.at(-1);
    if (!board && !last) return null;
    return { board, tag: board?.tag ?? last?.tag ?? null, name: board?.name ?? last?.name ?? null };
  });

/** The upstream banner's rows; "down" is computed from them per request (upstreamStatusOf). */
export const sharedUpstreamRows = () => sharedRead("upstream", [], upstreamRows);
