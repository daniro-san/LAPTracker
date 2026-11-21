// The members' board's reach on Home (D145, issue 484): how many members opened the board in the last 7 days,
// from the `lap_board_reach` PostHog Endpoint. A total only, never who (D75): under 5 it is not shown, and it
// is "at least", since some visits are never counted. Only after requireWorkspace, for the workspace's own
// slug; kept 1 h per workspace.
import { endpointRow, ENDPOINTS, shownTotal } from "../analytics/endpoints";
import type { Env } from "../env";
import type { WorkspaceAccess } from "./access";

const KEEP_S = 3_600;

/** Members who opened the board, at least; null when there is nothing to show (no key, PostHog down, under 5). */
export async function boardReach(
  env: Pick<Env, "POSTHOG_QUERY_API_KEY" | "POSTHOG_API_BASE_URL">,
  fetchImpl: typeof fetch,
  access: WorkspaceAccess,
): Promise<number | null> {
  const row = await endpointRow(env, fetchImpl, ENDPOINTS.boardReach, access.slug, KEEP_S);
  return row && shownTotal(row.board_visitors);
}
