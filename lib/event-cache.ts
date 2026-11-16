// The event page's shared cache (issue 327, D79): what the page reads from the database about one event,
// kept once for every viewer and request, tagged by the event's id. Only database rows go in; anything that
// depends on `now` is computed per request from them. Route handlers invalidate an event after a write that
// changes it (lib/run.ts after a run, the rename and settings routes). The real one is Next's data cache;
// tests get an in-memory one (lib/app-context.test-helpers.ts), because Next's needs a Next request.
import { revalidateTag, unstable_cache } from "next/cache";

import { SAMPLE_WAIT_MS } from "./live";

export interface EventCache {
  /**
   * `load`'s value for this event under `name`, shared until the event is invalidated or `maxAgeS` seconds
   * pass. The value goes through JSON, so it must hold no `Date`.
   */
  read<T>(eventId: number, name: string, maxAgeS: number, load: () => Promise<T>): Promise<T>;
  /** Forgets every value of this event. Only inside a route handler (Next's rule for `revalidateTag`). */
  invalidate(eventId: number): void;
}

/**
 * A live event's safety net: an entry is read again after this long even if an invalidation was missed.
 * Viewers refresh `SAMPLE_WAIT_MS` (60 s) after each slot, so the viewers of one refresh share one read, and
 * an entry is never more than one minute older than the database between two samples (15 minutes apart).
 */
export const LIVE_MAX_AGE_S = SAMPLE_WAIT_MS / 1000;
/** A finished event (its End has a row): no sample comes any more, so only an admin re-run or rename changes
 * it, and both invalidate. A day bounds a missed invalidation. */
export const DONE_MAX_AGE_S = 24 * 60 * 60;

const tagOf = (eventId: number) => `event:${eventId}`;

/** Reads of one key already on their way in this server instance: the viewers who refresh in the same
 * second share one database read, which Next's cache alone does not do on a miss. */
const inFlight = new Map<string, Promise<unknown>>();

export const nextEventCache: EventCache = {
  read<T>(eventId: number, name: string, maxAgeS: number, load: () => Promise<T>) {
    const key = `${name}:${eventId}`;
    const pending = inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const cached = unstable_cache(load, ["event-cache", key], {
      tags: [tagOf(eventId)],
      revalidate: maxAgeS,
    });
    const read = cached().finally(() => inFlight.delete(key));
    inFlight.set(key, read);
    return read;
  },
  invalidate(eventId: number) {
    // expire 0: the next read waits for fresh rows instead of being served the old ones once.
    revalidateTag(tagOf(eventId), { expire: 0 });
  },
};
