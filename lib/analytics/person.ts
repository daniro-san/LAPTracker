// The desk's and the board's person in PostHog (D115): a pseudonymous id, an HMAC of the workspace user's id
// under a key derived from CRON_SECRET, so the raw id never leaves the server and nobody without the secret
// can tell whose id it is. The same user keeps the same id on every device and day; a new CRON_SECRET makes
// new ids. Person properties are only the tier and the workspace slug: never a name, email or Discord id.
// The slug and the alliance's public tag also ride on every event of the page load (issue 452).
import { createHmac } from "node:crypto";

import { analyticsKey } from "./events";
import { eventWorkspace, type EventWorkspace } from "./server";

export type Tier = "officer" | "member";

export interface AnalyticsPersonProps extends EventWorkspace {
  id: string;
  tier: Tier;
}

/** A purpose-bound key, so this HMAC never equals any other use of the secret. */
const purposeKey = (secret: string) =>
  createHmac("sha256", secret).update("laptracker posthog person v1").digest();

export function analyticsPersonId(userId: number, secret: string): string {
  return `ws_${createHmac("sha256", purposeKey(secret)).update(String(userId)).digest("hex").slice(0, 32)}`;
}

/** What the page hands AnalyticsPerson, or null when analytics is off (D77: production with POSTHOG_KEY). */
export function analyticsPerson(
  env: { CRON_SECRET: string; VERCEL_ENV?: string | undefined; POSTHOG_KEY?: string | undefined },
  user: { userId: number; tier: Tier; slug: string; alliance: { tag: string | null } | null },
): AnalyticsPersonProps | null {
  if (!analyticsKey(env)) return null;
  return {
    id: analyticsPersonId(user.userId, env.CRON_SECRET),
    tier: user.tier,
    ...eventWorkspace(user),
  };
}
