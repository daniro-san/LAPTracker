// The public pages' shared cache (D143, issue 521): what they read from the database, kept once for every
// viewer and request until the next write. One tag, `reads`: every write to a table these reads use calls
// `invalidate` right after it (the daily read in the tick, its retry, "Get today's details", a run, a manual
// event's create, rename and settings; INVARIANT cache.write-invalidates-reads, lib/public-cache.test.ts).
// Only public rows go in, never desk data or a blocked roster key (D71); anything that depends on `now` is
// computed per request from them. The real one is Next's data cache, like lib/event-cache.ts; tests get an
// in-memory one (lib/app-context.test-helpers.ts).
import { revalidateTag, unstable_cache } from "next/cache";

export interface PublicCache {
  /**
   * `load`'s value under `name` and `key`, shared until the next `invalidate` or PUBLIC_MAX_AGE_S. Stored as
   * JSON text: a `Date` comes back as a `Date` (`encode`), and a value JSON cannot hold (a Map) throws. A
   * null (no such player or alliance) is never kept: a crawl of unknown ids leaves no entries.
   */
  read<T>(
    name: string,
    key: readonly (string | number | boolean | null)[],
    load: () => Promise<T>,
  ): Promise<T>;
  /** Forgets every value. Only inside a route handler or server action (Next's rule for `revalidateTag`). */
  invalidate(): void;
}

export const READS_TAG = "reads";

/** The safety net: an entry is read again after an hour even if an invalidation was missed. An expired
 * entry is served once while Next reads it again, and kept if that read fails (the database is down). */
export const PUBLIC_MAX_AGE_S = 60 * 60;

/** Next's data cache outlives a deployment on Vercel: an entry of an older build may hold an older shape. */
const BUILD = process.env.VERCEL_DEPLOYMENT_ID ?? "local";

/** JSON text with each `Date` as `{"$date": ms}`; a Map or Set throws instead of becoming `{}`. */
export function encode(value: unknown): string {
  return JSON.stringify(value ?? null, function (this: Record<string, unknown>, key, v: unknown) {
    const raw = this[key];
    if (raw instanceof Date) return { $date: raw.getTime() };
    if (raw instanceof Map || raw instanceof Set)
      throw new TypeError(`public cache: ${key} is a ${raw.constructor.name}`);
    return v;
  });
}

export function decode<T>(text: string): T {
  return JSON.parse(text, (_key, v: unknown) =>
    v !== null &&
    typeof v === "object" &&
    Object.keys(v).length === 1 &&
    typeof (v as { $date?: unknown }).$date === "number"
      ? new Date((v as { $date: number }).$date)
      : v,
  ) as T;
}

/** Thrown by the cached loader, so Next's cache keeps nothing (lib/wake-cache.ts), with the value it read:
 * a null, or rows read across an invalidation. This view is served them; the next one reads again. */
class NotKept extends Error {
  constructor(readonly value: unknown) {
    super("not kept");
  }
}

/**
 * This server instance's state, on `globalThis`: Next bundles route handlers and pages apart, each with its
 * own copy of this module, and an invalidation in a route must reach the pages' reads.
 * - `generation`: bumped by each `invalidate`; a read that ran across one may hold rows from before the write,
 *   so it is served once and not kept.
 * - `inFlight`: reads of one key already on their way: the viewers who miss the same key at the same moment
 *   share one database read, which Next's cache alone does not do (lib/event-cache.ts).
 */
const state = ((
  globalThis as { __publicReads?: { generation: number; inFlight: Map<string, Promise<unknown>> } }
).__publicReads ??= {
  generation: 0,
  inFlight: new Map(),
});
const { inFlight } = state;

export const nextPublicCache: PublicCache = {
  read<T>(
    name: string,
    key: readonly (string | number | boolean | null)[],
    load: () => Promise<T>,
  ) {
    const id = JSON.stringify([name, ...key]);
    const pending = inFlight.get(id) as Promise<T> | undefined;
    if (pending) return pending;
    const cached = unstable_cache(
      async () => {
        const from = state.generation;
        const value = await load();
        if (value === null || state.generation !== from) throw new NotKept(value);
        return encode(value);
      },
      ["reads", BUILD, id],
      { tags: [READS_TAG], revalidate: PUBLIC_MAX_AGE_S },
    );
    const read = cached()
      .then(
        (text) => decode<T>(text),
        (error: unknown) => {
          if (error instanceof NotKept) return error.value as T;
          throw error;
        },
      )
      .finally(() => {
        // An `invalidate` may have let a newer read take the key: leave that one in place.
        if (inFlight.get(id) === read) inFlight.delete(id);
      });
    inFlight.set(id, read);
    return read;
  },
  invalidate() {
    // A read that began before the write must not be joined by a view after it, nor be kept.
    state.generation += 1;
    inFlight.clear();
    // expire 0: the first view after a write waits for fresh rows instead of being served the old ones once.
    revalidateTag(READS_TAG, { expire: 0 });
  },
};
