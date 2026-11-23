// The desk's adoption (D115): every write an officer makes that went through becomes one `ws_action` event
// (feature and action, two words from closed lists, and the workspace and its alliance's tag, issue 452) on
// the officer's pseudonymous id, after the response. Nothing about what was written: no member, value, name
// or text. Off unless analytics is (D77).
import { analyticsKey } from "../analytics/events";
import { analyticsPersonId } from "../analytics/person";
import {
  captureServer,
  eventWorkspace,
  sendLater,
  type DeskAction,
  type DeskFeature,
  type DeskPlace,
  type DeskPost,
} from "../analytics/server";
import type { AppContext } from "../app-context";
import type { WorkspaceAccess } from "./access";

/**
 * `response`, unchanged; when it is a success (2xx), the write is counted as `feature` / `action`. `access`
 * is the officer's, or for the invite's "finish" the workspace it just made and its first officer.
 */
export function withActionEvent(
  ctx: Pick<AppContext, "env" | "fetch">,
  access: Pick<WorkspaceAccess, "slug"> & {
    alliance: { tag: string | null } | null;
    user: { id: number };
  },
  feature: DeskFeature,
  action: DeskAction,
  response: Response,
  /**
   * Follow-up's records (issue 516): from the tab or a card, and whether the member was on the list; or a
   * catalog post's switch or settings (D159): which post.
   */
  place?: DeskPlace | { post: DeskPost },
): Response {
  if (!response.ok || !analyticsKey(ctx.env)) return response;
  const person = analyticsPersonId(access.user.id, ctx.env.CRON_SECRET);
  sendLater(() =>
    captureServer(ctx.env, ctx.fetch, [
      {
        event: "ws_action",
        person,
        properties: { feature, action, ...place },
        where: eventWorkspace(access),
      },
    ]),
  );
  return response;
}
