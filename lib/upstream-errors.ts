// How the collector names upstream failures in rows, logs and messages: our own words from our own
// error classes, never a third-party message (plan §12.3). Split from lib/collector.ts for its size.
import {
  NotFoundError,
  NotLiveError,
  QuotaExhaustedError,
  SchemaError,
  UpstreamError,
} from "./sources/types";

/** One line from our own error classes; never a third-party message. */
export function describe(e: unknown): string {
  if (e instanceof UpstreamError) return `http ${e.status}`;
  if (e instanceof NotFoundError) return "not found";
  if (e instanceof NotLiveError) return "not live";
  if (e instanceof SchemaError) return e.code;
  if (e instanceof QuotaExhaustedError) return "quota exhausted (429)";
  return e instanceof Error ? e.name : "unknown error";
}

/** The adapter returns only on 2xx and exposes no status then, so success is recorded as 200. */
export function httpStatusOf(e: unknown): number | null {
  if (e === undefined) return 200;
  if (e instanceof UpstreamError) return e.status;
  if (e instanceof QuotaExhaustedError) return 429;
  return e instanceof NotFoundError ? 404 : null;
}
