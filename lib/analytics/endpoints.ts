// PostHog Endpoints (D145, issue 484): saved HogQL queries in project 741657, run by name from the server with
// POSTHOG_QUERY_API_KEY. The one variable is the workspace's slug; the queries count by the events'
// `workspace` property and return totals only, never a person. A read is kept per endpoint and workspace in
// Next's data cache for the caller's `revalidate`. No key, an error status, a network error, a timeout or an
// answer of another shape all mean "nothing", so a page draws nothing; a failure is never kept.
import { unstable_cache } from "next/cache";
import { z } from "zod";

import type { Env } from "../env";

/** The PostHog project the Endpoints live in (D77). */
export const POSTHOG_PROJECT_ID = 741657;
const TIMEOUT_MS = 3_000;

/** Each Endpoint by its name in PostHog, pinned to a version so an edit there cannot change the answer's shape. */
export const ENDPOINTS = {
  boardReach: { name: "lap_board_reach", version: 1 },
  allianceUsage: { name: "lap_alliance_usage", version: 1 },
} as const;
export type Endpoint = (typeof ENDPOINTS)[keyof typeof ENDPOINTS];

/** One HogQL answer: the column names and the rows, each row its cells in the columns' order. */
const answer = z.object({
  columns: z.array(z.string()),
  results: z.array(z.array(z.unknown())),
});

export type EndpointRow = Record<string, unknown>;

/** The first row of the answer, by column name. Throws on any failure, so a failed read is never kept. */
async function run(
  env: Pick<Env, "POSTHOG_API_BASE_URL">,
  key: string,
  fetchImpl: typeof fetch,
  endpoint: Endpoint,
  workspace: string,
): Promise<EndpointRow> {
  const url = `${env.POSTHOG_API_BASE_URL}/api/projects/${POSTHOG_PROJECT_ID}/endpoints/${endpoint.name}/run?version=${endpoint.version}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ variables: { workspace } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`endpoint.status_${res.status}`);
  const body = answer.parse(await res.json());
  const row = body.results[0] ?? [];
  return Object.fromEntries(body.columns.map((c, i) => [c, row[i] ?? null]));
}

/**
 * The Endpoint's first row for one workspace, or null when there is no key or PostHog does not answer in
 * time. Kept per endpoint, version and workspace for `revalidateS`. The key is not an argument of the cached
 * function, so it is neither in the cache key nor in the line Next logs when a refresh fails.
 */
export async function endpointRow(
  env: Pick<Env, "POSTHOG_QUERY_API_KEY" | "POSTHOG_API_BASE_URL">,
  fetchImpl: typeof fetch,
  endpoint: Endpoint,
  workspace: string,
  revalidateS: number,
): Promise<EndpointRow | null> {
  const key = env.POSTHOG_QUERY_API_KEY;
  if (!key) return null;
  const read = unstable_cache(
    () => run(env, key, fetchImpl, endpoint, workspace),
    ["posthog-endpoint", endpoint.name, String(endpoint.version), workspace],
    { revalidate: revalidateS, tags: ["posthog-endpoints"] },
  );
  return read().catch(() => null);
}

/** The smallest total a page may show (issue 484): under it, nothing. */
export const MIN_TOTAL = 5;

/**
 * A count cell as a total a page may show: rounded down to a multiple of MIN_TOTAL, so it stays "at least" and
 * one person more or less within an hour's refresh does not show (adversarial panel); under MIN_TOTAL, null.
 */
export function shownTotal(cell: unknown): number | null {
  const n = typeof cell === "string" ? Number(cell) : cell;
  if (typeof n !== "number" || !Number.isInteger(n) || n < MIN_TOTAL) return null;
  return n - (n % MIN_TOTAL);
}

/** A first-time cell (`minIf`) as a date; null for none, including `minIf`'s 1970 for "never". */
export function firstTime(cell: unknown): Date | null {
  if (typeof cell !== "string" || cell === "") return null;
  const at = new Date(cell);
  return Number.isNaN(at.getTime()) || at.getUTCFullYear() < 2000 ? null : at;
}
