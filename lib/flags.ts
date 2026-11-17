// Feature flags from PostHog (D91): the owner turns a feature on or off in the PostHog project, with no deploy.
// Server only: pages read the flags at render time and pass booleans down, so no flag SDK reaches the browser
// and nothing flashes. A flag is on only when PostHog answers `enabled: true` for it; no key, a missing flag,
// an error status, a network error, a timeout or a body that is not JSON all mean off.
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { POSTHOG_INGEST_HOST } from "./analytics/region";
import { getEnv, type Env } from "./env";

/** Every flag, by its exact key in PostHog. */
export const FLAGS = ["merge-simulator", "chart-details", "kill-vs-might", "war-turnout"] as const;
export type Flag = (typeof FLAGS)[number];

/** The only id a flag read is made for: no visitor's id, cookie or address goes to PostHog. */
const DISTINCT_ID = "laptracker-server";
const TIMEOUT_MS = 1_500;
/** A flag changed in PostHog shows within about this many seconds. */
const MAX_AGE_S = 60;

/** The flags PostHog has on. Throws on any failure, so a failed read is never kept in the cache. */
async function fetchFlags(key: string): Promise<Flag[]> {
  const res = await fetch(`${POSTHOG_INGEST_HOST}/flags?v=2`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: key, distinct_id: DISTINCT_ID }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`flags.status_${res.status}`);
  const body = (await res.json()) as {
    flags?: Record<string, { enabled?: unknown } | null>;
  } | null;
  return FLAGS.filter((f) => body?.flags?.[f]?.enabled === true);
}

/**
 * The flags on for this environment. With POSTHOG_KEY: PostHog's answer, shared between requests for
 * MAX_AGE_S in Next's data cache (as lib/event-cache.ts); a failed refresh keeps the last answer, a failed
 * first read is off. Without it: the keys in LOCAL_FLAGS.
 */
export async function flagsOf(
  env: Pick<Env, "POSTHOG_KEY" | "LOCAL_FLAGS">,
): Promise<ReadonlySet<Flag>> {
  const key = env.POSTHOG_KEY;
  if (!key) {
    const local = (env.LOCAL_FLAGS ?? "").split(",").map((s) => s.trim());
    return new Set(FLAGS.filter((f) => local.includes(f)));
  }
  // The key is not an argument of the cached function, so it is neither in the cache key nor in the line
  // Next logs when a refresh fails.
  const read = unstable_cache(() => fetchFlags(key), ["flags"], {
    revalidate: MAX_AGE_S,
    tags: ["flags"],
  });
  return new Set(await read().catch(() => []));
}

/** This deployment's flags, read once per request. */
const flagsOn = cache(() => flagsOf(getEnv()));

/** Whether a feature is on for this request. */
export const isOn = async (flag: Flag): Promise<boolean> => (await flagsOn()).has(flag);
