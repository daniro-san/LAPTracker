// The tick's memory between calls (D141, issue 521): the few facts that only the database knows and that
// decide whether a tick needs it at all. A fact is kept only once it holds ("no rehearsal is pending",
// "today's squads queue is settled"); while it does not, every call checks the database again, which the
// work it waits for needs anyway. Shared by every instance through Next's data cache, like the event cache
// (lib/event-cache.ts); tests get an in-memory one (lib/app-context.test-helpers.ts).
import { revalidateTag, unstable_cache } from "next/cache";

export interface WakeCache {
  /**
   * True when `check` said so, kept until `forget` or `maxAgeS` seconds pass. A false is never kept: the
   * next call runs `check` again.
   */
  holds(key: string, maxAgeS: number, check: () => Promise<boolean>): Promise<boolean>;
  /** Forgets every kept fact. Only inside a route handler (Next's rule for `revalidateTag`). */
  forget(): void;
}

const TAG = "wake";

/** Thrown by the cached loader when the fact does not hold, so Next's cache keeps nothing. */
class NotYet extends Error {}

export const nextWakeCache: WakeCache = {
  async holds(key, maxAgeS, check) {
    const load = unstable_cache(
      async () => {
        if (!(await check())) throw new NotYet();
        return true;
      },
      ["wake", key],
      { tags: [TAG], revalidate: maxAgeS },
    );
    try {
      return await load();
    } catch (error) {
      if (error instanceof NotYet) return false;
      throw error;
    }
  },
  forget() {
    revalidateTag(TAG, { expire: 0 });
  },
};
