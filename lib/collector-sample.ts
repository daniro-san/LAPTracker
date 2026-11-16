// A sample's limits on the collector's reads (D69). Split from lib/collector.ts, which re-exports the
// constants and calls `callOptions` for every /v1 call.
import type { CallOptions } from "./sources/types";

/** A sample's run deadline: the tick answers before cron-job.org abandons the call at 30 s (D30). */
export const SAMPLE_DEADLINE_MS = 25_000;
/** A sample's per-call timeout, against 30 s for a phase: some live reads hang until the timeout. */
export const SAMPLE_CALL_TIMEOUT_MS = 12_000;

/** A sample's calls carry its timeout; an alliance that failed in an earlier sample of the event gets one
 * attempt and no retries. A phase's calls keep the adapter's defaults. `unionId` is null for the quota call.
 * INVARIANT sample.failed-reads-once: a read that already failed this event must not spend its retries and
 * the run's 25 s again in every later sample. */
export const callOptions = (
  run: { sample: boolean; noRetry: ReadonlySet<number> },
  unionId: number | null,
): CallOptions =>
  run.sample
    ? {
        timeoutMs: SAMPLE_CALL_TIMEOUT_MS,
        maxRetries: unionId !== null && run.noRetry.has(unionId) ? 0 : undefined,
      }
    : {};
