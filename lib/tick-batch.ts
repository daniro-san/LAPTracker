// When a tick's batch can be running (D141): the one clock rule for every page that polls for a run, the
// desk's read status bar (D135) and /admin's run watch. Pure, so client components import it too.

/**
 * cron-job.org's ticks come at :00, :15, :30 and :45 (D30), and tick.yml's at :07, :22, :37 and :52 (D26);
 * each one can start the reads' next batch.
 */
const TICK_EVERY_MS = 15 * 60_000;
const TICK_OFFSETS_MS = [0, 7 * 60_000];
/** A tick's batches end within this of its slot: its own work (100 s) and its `after` (180 s, D137). */
const BATCH_SPAN_MS = 5 * 60_000;

/**
 * D141: a run or a read changes only while a tick's batch runs, so a poll asks only in the first 5 minutes
 * after each tick of either scheduler, while the database is awake for the batch anyway.
 */
export const batchMayRun = (now: number): boolean =>
  TICK_OFFSETS_MS.some((offset) => (now - offset + TICK_EVERY_MS) % TICK_EVERY_MS < BATCH_SPAN_MS);
