// A sample's limits on the collector's reads (D69). Split from lib/collector.ts, which re-exports the
// constants and calls `callOptions` for every /v1 call.
import type { CallOptions } from "./sources/types";

/** A sample's run deadline: the tick answers before cron-job.org abandons the call at 30 s (D30). */
export const SAMPLE_DEADLINE_MS = 25_000;
/** A sample's per-call timeout, against 30 s for a phase: some live reads hang until the timeout, and a
 * normal one answers in about 1 s. With 4 calls hung at once, the run's 4 slots are free again after 6 s,
 * so the remaining alliances are still read within SAMPLE_DEADLINE_MS (D69 amendment, 2026-11-28). */
export const SAMPLE_CALL_TIMEOUT_MS = 6_000;

/** A sample's calls carry its timeout and one attempt each: no retry inside a sample, the next sample
 * reads the alliance again. A phase's calls keep the adapter's defaults. `unionId` is null for the quota call.
 * INVARIANT sample.failed-reads-once: a read that already failed this event must not spend retries and the
 * run's 25 s again in every later sample; with no sample retrying at all (D69 amendment, 2026-11-28), every
 * sample read is one attempt. */
export const callOptions = (run: { sample: boolean }): CallOptions =>
  run.sample ? { timeoutMs: SAMPLE_CALL_TIMEOUT_MS, maxRetries: 0 } : {};
