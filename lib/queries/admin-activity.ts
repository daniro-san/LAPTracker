// /admin's Activity section (D145, issue 484): each workspace's last 7 days and its first steps, from the
// `lap_alliance_usage` PostHog Endpoint, one call per workspace, kept 15 min per workspace. Totals only, never
// a person; a total under 5 is null. A workspace PostHog did not answer for is left out.
import { endpointRow, ENDPOINTS, firstTime, shownTotal } from "../analytics/endpoints";
import type { Env } from "../env";

const KEEP_S = 900;

/** The 7-day totals, each null under 5. */
export const ACTIVITY_TOTALS = [
  "officers_active",
  "board_visitors",
  "notices_written",
  "roll_call_marks",
  "thanks_shared",
  "screenshots_read",
] as const;
export type ActivityTotal = (typeof ACTIVITY_TOTALS)[number];

/** The setup steps, in order (issue 484): when each first happened, or null. */
export const SETUP_STEPS = [
  "key_saved",
  "bot_installed",
  "first_roll_call",
  "first_notice",
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export interface AllianceActivity {
  slug: string;
  totals: Record<ActivityTotal, number | null>;
  /** When the invite made the workspace; null for one made before the event existed, or on /admin. */
  created: Date | null;
  steps: Record<SetupStep, Date | null>;
}

export async function allianceActivity(
  env: Pick<Env, "POSTHOG_QUERY_API_KEY" | "POSTHOG_API_BASE_URL">,
  fetchImpl: typeof fetch,
  slugs: string[],
): Promise<AllianceActivity[]> {
  if (!env.POSTHOG_QUERY_API_KEY) return [];
  const rows = await Promise.all(
    slugs.map(async (slug) => {
      const row = await endpointRow(env, fetchImpl, ENDPOINTS.allianceUsage, slug, KEEP_S);
      if (!row) return null;
      return {
        slug,
        totals: Object.fromEntries(
          ACTIVITY_TOTALS.map((k) => [k, shownTotal(row[k])]),
        ) as AllianceActivity["totals"],
        created: firstTime(row.created),
        steps: Object.fromEntries(
          SETUP_STEPS.map((k) => [k, firstTime(row[k])]),
        ) as AllianceActivity["steps"],
      };
    }),
  );
  return rows.filter((r) => r !== null);
}
