// When the read status bar (D135) must look at the clock again: at the soonest `until` still ahead, so a
// finished read's line goes 30 minutes after it ended. Null once no line is left to go: no timer at all, so
// an expired line never keeps a zero-delay timer redrawing the bar (review of PR 515).
import type { StatusLine } from "@/lib/private/read-status";

/** Milliseconds to wait from `now`, 0 before the first look (`now` 0, while mounting), or null. */
export function nextWake(lines: readonly StatusLine[], now: number): number | null {
  if (now === 0) return 0;
  const ahead = lines.flatMap((l) => (l.until !== undefined && l.until > now ? [l.until] : []));
  return ahead.length > 0 ? Math.min(...ahead) - now : null;
}

/** cron-job.org's ticks come at :00, :15, :30 and :45 (D30), and each one starts the reads' next batch. */
const TICK_EVERY_MS = 15 * 60_000;
/** A tick's batches end within this of its slot: its own work (100 s) and its `after` (180 s, D137). */
const BATCH_SPAN_MS = 5 * 60_000;

/**
 * D141: a running read changes only while a tick's batch runs, so the bar's 30 s poll asks only in the first
 * 5 minutes of each tick slot, while the database is awake for the batch anyway.
 */
export const batchMayRun = (now: number): boolean => now % TICK_EVERY_MS < BATCH_SPAN_MS;
