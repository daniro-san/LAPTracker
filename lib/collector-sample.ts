// A sample's limits on the collector's reads (D69). Split from lib/collector.ts, which re-exports the
// constants and calls `callOptions` for every /v1 call.
import type { CallOptions } from "./sources/types";

/** A sample's run deadline: the tick answers before cron-job.org abandons the call at 30 s (D30). */
export const SAMPLE_DEADLINE_MS = 25_000;
/** A sample's per-call timeout, against 30 s for a phase: some live reads hang until the timeout, and a
 * normal one answers in about 1 s. With 4 calls hung at once, the run's 4 slots are free again after 6 s,
 * so the remaining alliances are still read within SAMPLE_DEADLINE_MS (D69 amendment, 2026-11-28). */
export const SAMPLE_CALL_TIMEOUT_MS = 6_000;

/** A sample's calls carry its timeout. Its alliance reads get one attempt each: no retry inside a sample, the
 * next sample reads the alliance again. Its quota call keeps the adapter's 502/503/504 retries: without it
 * the sample reads nothing. A phase's calls keep the adapter's defaults.
 * INVARIANT sample.failed-reads-once: a read that already failed this event must not spend retries and the
 * run's 25 s again in every later sample; with no sample alliance read retrying (D69 amendment, 2026-11-28),
 * every one is a single attempt. */
export const callOptions = (run: { sample: boolean }, call: "quota" | "alliance"): CallOptions =>
  !run.sample
    ? {}
    : call === "quota"
      ? { timeoutMs: SAMPLE_CALL_TIMEOUT_MS }
      : { timeoutMs: SAMPLE_CALL_TIMEOUT_MS, maxRetries: 0 };
