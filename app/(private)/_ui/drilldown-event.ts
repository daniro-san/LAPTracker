// What `ws_drilldown_opened` carries on Raid prep and the Roll call list (PR 691), the one desk drilldown event
// (issue 678): the page, the kind of set and how many it held as a bucket. Never a name, a uid or the exact count.
import { countBucket } from "@/lib/analytics/count-bucket";
import type { RaidPrepSet, RollCallSet } from "@/lib/analytics/events";

/** "Show the n ›" beside "To remind: n" (`remind`) or "Mark ✓ the n seen with a shield" (`accept`). */
export const prepOpened = (kind: RaidPrepSet, n: number) => ({
  surface: "raid_prep" as const,
  kind,
  count_bucket: countBucket(n),
});

/** A Roll call card's count opened its marking page on this chip, which held `n`. */
export const rollCallOpened = (kind: RollCallSet, n: number) => ({
  surface: "roll_call" as const,
  kind,
  count_bucket: countBucket(n),
});

const LINKED: readonly RollCallSet[] = ["todo", "no", "yes"];

/**
 * The chip a card's count named in the address (`?filter=`), or null when the page was not opened from
 * one: a plain open, or `all`, which no count links.
 */
export const openedFrom = (value: unknown): RollCallSet | null =>
  LINKED.find((k) => k === value) ?? null;
