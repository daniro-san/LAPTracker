// /admin's Activity section (D145, issue 484): each workspace's last 7 days, from the `lap_alliance_usage`
// PostHog Endpoint, one call per workspace, kept 15 min per workspace. Totals only, never a person. People
// counts under 5 are null and the rest rounded down; action counts are exact (D145, amended 2026-11-21). A
// workspace PostHog did not answer for is left out. The setup steps come from our own tables (admin-alliances).
import { endpointRow, ENDPOINTS, shownTotal } from "../analytics/endpoints";
import type { Env } from "../env";

const KEEP_S = 900;

/** The 7-day totals, in the order shown. */
export const ACTIVITY_TOTALS = [
  "officers_active",
  "board_visitors",
  "notices_written",
  "roll_call_marks",
  "thanks_shared",
  "screenshots_read",
] as const;
export type ActivityTotal = (typeof ACTIVITY_TOTALS)[number];

/** The counts of people: under 5 is null, the rest rounded down to a multiple of 5 (D75). */
export const PEOPLE_TOTALS: readonly ActivityTotal[] = ["officers_active", "board_visitors"];

/** An action count as it is: a whole number from 0; null for any other cell. */
function exact(cell: unknown): number | null {
  const n = typeof cell === "string" ? Number(cell) : cell;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null;
}

export interface AllianceActivity {
  slug: string;
  /** People counts: null under 5. Action counts: always a number. */
  totals: Record<ActivityTotal, number | null>;
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
      const totals = Object.fromEntries(
        ACTIVITY_TOTALS.map((k) => [
          k,
          PEOPLE_TOTALS.includes(k) ? shownTotal(row[k]) : exact(row[k]),
        ]),
      ) as AllianceActivity["totals"];
      // An action count that is not a whole number is an answer of another shape: nothing (D145).
      if (ACTIVITY_TOTALS.some((k) => !PEOPLE_TOTALS.includes(k) && totals[k] === null)) {
        return null;
      }
      return { slug, totals };
    }),
  );
  return rows.filter((r) => r !== null);
}
