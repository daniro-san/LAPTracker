// The collector's one log line per /v1 call (plan "Observability"). Split from lib/collector.ts.
import type { Logger } from "./logger";
import type { Quota } from "./sources/types";
import { describe, httpStatusOf, upstreamDetail } from "./upstream-errors";

/** One run_logs line per /v1 call; retries add their own v1.retry lines. */
export async function logV1Fetch(
  run: { deps: { logger: Logger; now: () => Date } },
  started: Date,
  call: { endpoint: "alliance" | "quota"; unionId: number | null },
  result: { cached?: boolean | null; quota?: Quota | null; error?: unknown },
): Promise<void> {
  const e = result.error;
  await run.deps.logger[e === undefined ? "info" : "warn"]("v1.fetch", {
    endpoint: call.endpoint,
    union_id: call.unionId,
    http_status: httpStatusOf(e),
    cached: result.cached ?? null,
    duration_ms: run.deps.now().getTime() - started.getTime(),
    quota_remaining: result.quota?.remaining ?? null,
    // D61: what the upstream answered (status, headers, body start, or the timeout), for the run page.
    ...(e === undefined ? {} : { error: describe(e), detail: upstreamDetail(e) }),
  });
}
