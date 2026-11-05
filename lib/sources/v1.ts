// Documented API adapter (/v1, the primary and only required source, plan §2, §3.5).
// Every call spends 1 of 1,000 daily requests, retries and /v1/quota included.
import { z } from "zod";

import { getSourceEnv } from "../env";
import { readBody, rosterFields, TIMEOUT_MS, toSnapshotInput, USER_AGENT } from "./shared";
import {
  type AllianceSnapshotInput,
  NotFoundError,
  type OnAttempt,
  type Quota,
  QuotaExhaustedError,
  type UnionId,
  UpstreamError,
} from "./types";

const MAX_IN_FLIGHT = 4;
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000] as const;
const JITTER_MS = 250;
/** A Retry-After above this is clamped, so one header cannot outlast the route's maxDuration. */
const MAX_RETRY_AFTER_MS = 30_000;
const RETRYABLE = new Set([502, 503, 504]);

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  for (let attempt = 0; ; attempt++) {
    // INVARIANT calls.max-upstream: every attempt is reported before it is sent, retries included.
    onAttempt?.(attempt);
    const response = await limited(() =>
      fetch(`${env.LAP_API_BASE_URL}${path}`, {
        headers,
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
          : AbortSignal.timeout(TIMEOUT_MS),
      }),
    );
    // Branch on status only: statusText is empty over HTTP/2 on Node 26 (plan §11.4).
    const { status } = response;
    if (status >= 200 && status < 300) return response;
    await response.body?.cancel();
    // INVARIANT quota-429-aborts: never retried.
    if (status === 429) throw new QuotaExhaustedError(`429 on ${path}`);
    if (status === 404) throw new NotFoundError(`404 on ${path}`);
    // INVARIANT retry-only-5xx-gateway: 502/503/504, max 3, backoff + jitter, Retry-After honoured.
    if (!RETRYABLE.has(status) || attempt >= MAX_RETRIES) throw new UpstreamError(status);
    await sleep(retryDelayMs(attempt, response.headers.get("retry-after")));
  }
}

export async function fetchAlliance(
  id: UnionId,
  onAttempt?: OnAttempt,
  signal?: AbortSignal,
): Promise<AllianceSnapshotInput> {
  const response = await request(`/alliances/${id}`, onAttempt, signal);
  const { data, raw } = await readBody(response, allianceSchema, "v1.schema");
  return toSnapshotInput(data, { cached: data.cached, quota: data.quota, raw });
}

export async function fetchQuota(onAttempt?: OnAttempt, signal?: AbortSignal): Promise<Quota> {
  const response = await request("/quota", onAttempt, signal);
  const { data } = await readBody(response, quotaResponseSchema, "v1.schema");
  return data.quota;
}
