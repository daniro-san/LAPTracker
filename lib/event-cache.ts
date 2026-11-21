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

/** Next's data cache outlives a deployment on Vercel: an entry of an older build may hold older figures (a
 * finished event's for a day), so a new build reads its own (as lib/public-cache.ts). */
const BUILD = process.env.VERCEL_DEPLOYMENT_ID ?? "local";

/** Thrown by the cached loader, so Next's cache keeps nothing, with the rows it read across an
 * invalidation: this view is served them; the next one reads again (as lib/public-cache.ts). */
class NotKept extends Error {
  constructor(readonly value: unknown) {
    super("not kept");
  }
}

/**
 * This server instance's state, on `globalThis` as in lib/public-cache.ts: Next bundles route handlers and
 * pages apart, each with its own copy of this module.
 * - `generation`: bumped by each `invalidate`; a read that ran across one is served once and not kept.
 * - `inFlight`: reads of one key already on their way: the viewers who refresh in the same second share one
 *   database read, which Next's cache alone does not do on a miss.
 */
const state = ((
  globalThis as { __eventReads?: { generation: number; inFlight: Map<string, Promise<unknown>> } }
).__eventReads ??= { generation: 0, inFlight: new Map() });
const { inFlight } = state;

export const nextEventCache: EventCache = {
  read<T>(eventId: number, name: string, maxAgeS: number, load: () => Promise<T>) {
    const key = `${name}:${eventId}`;
    const pending = inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const cached = unstable_cache(
      async () => {
        const from = state.generation;
        const value = await load();
        if (state.generation !== from) throw new NotKept(value);
        return value;
      },
      ["event-cache", BUILD, key],
      { tags: [tagOf(eventId)], revalidate: maxAgeS },
    );
    const read = cached()
      .catch((error: unknown) => {
        if (error instanceof NotKept) return error.value as T;
        throw error;
      })
      .finally(() => {
        // A newer read may have taken the key: leave that one in place.
        if (inFlight.get(key) === read) inFlight.delete(key);
      });
    inFlight.set(key, read);
    return read;
  },
  invalidate(eventId: number) {
    // A read that began before the write must not be joined by a view after it, nor be kept.
    state.generation += 1;
    for (const key of inFlight.keys()) if (key.endsWith(`:${eventId}`)) inFlight.delete(key);
    // expire 0: the next read waits for fresh rows instead of being served the old ones once.
    revalidateTag(tagOf(eventId), { expire: 0 });
  },
};
