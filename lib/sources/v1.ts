// Documented API adapter (/v1, the primary and only required source, plan §2, §3.5).
// Every call spends 1 of 1,000 daily requests, retries and /v1/quota included.
import { z } from "zod";

import { getSourceEnv } from "../env";
import { redact } from "../redact";
import { readBody, rosterFields, TIMEOUT_MS, toSnapshotInput, USER_AGENT } from "./shared";
import {
  type AllianceSnapshotInput,
  NotFoundError,
  type OnAttempt,
  type Quota,
  QuotaExhaustedError,
  RequestError,
  type UnionId,
  type UpstreamDetail,
  UpstreamError,
} from "./types";

const MAX_IN_FLIGHT = 4;
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000] as const;
const JITTER_MS = 250;
/** A Retry-After above this is clamped, so one header cannot outlast the route's maxDuration. */
const MAX_RETRY_AFTER_MS = 30_000;
const RETRYABLE = new Set([502, 503, 504]);
/** What an error answer keeps for /admin (D61): these headers and the body's first characters. */
const DETAIL_HEADERS = [
  "retry-after",
  "content-type",
  "date",
  "server",
  "cf-ray",
  "x-request-id",
  "x-cache",
];
const DETAIL_BODY_CHARS = 1000;

const quotaSchema = z.object({
  limit: z.number().int(),
  used: z.number().int(),
  remaining: z.number().int(),
});

// The alliance response is a flat object, no wrapper (plan §2).
const allianceSchema = z.object({ ...rosterFields, cached: z.boolean(), quota: quotaSchema });
const quotaResponseSchema = z.object({ quota: quotaSchema });

let inFlight = 0;
const waiting: (() => void)[] = [];

/** Concurrency cap shared by every /v1 call in this process. */
async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (inFlight < MAX_IN_FLIGHT) inFlight++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else inFlight--;
  }
}

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  return (BACKOFF_MS[attempt] ?? 4000) + Math.random() * JITTER_MS;
}

/** The backoff wait; the run's signal (deadline, a worker's throw) ends it at once. */
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

/** An HTTP error answer as /admin shows it: path, status, the headers that help, the body's start. */
async function httpDetail(path: string, response: Response): Promise<UpstreamDetail> {
  const body = await response.text().catch(() => "");
  const headers = Object.fromEntries(
    DETAIL_HEADERS.flatMap((h) => {
      const value = response.headers.get(h);
      return value === null ? [] : [[h, value]];
    }),
  );
  const detail = { path, status: response.status, headers, body: body.slice(0, DETAIL_BODY_CHARS) };
  return redact(detail) as UpstreamDetail;
}

/** A request with no HTTP answer, as /admin shows it: the path, the timeout or the network cause. */
function noAnswerDetail(path: string, e: unknown): UpstreamDetail {
  const inner = e instanceof Error && e.cause instanceof Error ? e.cause : e;
  const cause = inner instanceof Error ? `${inner.name}: ${inner.message}` : String(inner);
  const timeout = e instanceof Error && e.name === "TimeoutError";
  return redact({ path, ...(timeout && { timeoutMs: TIMEOUT_MS }), cause }) as UpstreamDetail;
}

/** The error a non-2xx answer ends the call with, or null when the call is tried again. */
async function answerError(
  path: string,
  response: Response,
  attempt: number,
): Promise<Error | null> {
  const { status } = response;
  // INVARIANT quota-429-aborts: never retried.
  if (status === 429)
    return new QuotaExhaustedError(`429 on ${path}`, await httpDetail(path, response));
  if (status === 404) return new NotFoundError(`404 on ${path}`, await httpDetail(path, response));
  // INVARIANT retry-only-5xx-gateway: 502/503/504, max 3, backoff + jitter, Retry-After honoured.
  if (!RETRYABLE.has(status) || attempt >= MAX_RETRIES)
    return new UpstreamError(status, await httpDetail(path, response));
  return null;
}

async function request(
  path: string,
  onAttempt?: OnAttempt,
  signal?: AbortSignal,
): Promise<Response> {
  const env = getSourceEnv();
  const headers = {
    Authorization: `Bearer ${env.LAP_API_KEY}`,
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
  let previous: number | null = null;
  for (let attempt = 0; ; attempt++) {
    // INVARIANT calls.max-upstream: every attempt is reported before it is sent, retries included.
    onAttempt?.(attempt, previous);
    let response: Response;
    try {
      response = await limited(() =>
        fetch(`${env.LAP_API_BASE_URL}${path}`, {
          headers,
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
            : AbortSignal.timeout(TIMEOUT_MS),
        }),
      );
    } catch (e) {
      // The caller's signal (the run deadline) ends the call on purpose; anything else got no answer.
      if (signal?.aborted) throw e;
      throw new RequestError(e, noAnswerDetail(path, e));
    }
    // Branch on status only: statusText is empty over HTTP/2 on Node 26 (plan §11.4).
    if (response.status >= 200 && response.status < 300) return response;
    const error = await answerError(path, response, attempt);
    if (error) throw error;
    await response.body?.cancel();
    previous = response.status;
    await sleep(retryDelayMs(attempt, response.headers.get("retry-after")), signal);
  }
}

export async function fetchAlliance(
  id: UnionId,
  onAttempt?: OnAttempt,
  signal?: AbortSignal,
): Promise<AllianceSnapshotInput> {
  // D64: a live game lookup, not the API's cached copy. Its cache keeps a copy up to 60 minutes, past
  // our 20-minute freshness rule; a live read costs the same request and takes about 1-2 s.
  const response = await request(`/alliances/${id}?fresh=1`, onAttempt, signal);
  const { data, raw } = await readBody(response, allianceSchema, "v1.schema");
  return toSnapshotInput(data, { cached: data.cached, quota: data.quota, raw });
}

export async function fetchQuota(onAttempt?: OnAttempt, signal?: AbortSignal): Promise<Quota> {
  const response = await request("/quota", onAttempt, signal);
  const { data } = await readBody(response, quotaResponseSchema, "v1.schema");
  return data.quota;
}
