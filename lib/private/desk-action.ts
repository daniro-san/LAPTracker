// The desk's adoption (D115): every write an officer makes that went through becomes one `ws_action` event
// (feature and action, two words from closed lists) on the officer's pseudonymous id, after the response.
// Nothing about what was written: no member, value, name or text. Off unless analytics is (D77).
import { analyticsKey } from "../analytics/events";
import { analyticsPersonId } from "../analytics/person";
import { captureServer, sendLater, type DeskAction, type DeskFeature } from "../analytics/server";
import type { AppContext } from "../app-context";
import type { WorkspaceAccess } from "./access";

/** `response`, unchanged; when it is a success (2xx), the write is counted as `feature` / `action`. */
export function counted(
  ctx: Pick<AppContext, "env" | "fetch">,
  access: WorkspaceAccess,
  feature: DeskFeature,
  action: DeskAction,
  response: Response,
): Response {
  if (!response.ok || !analyticsKey(ctx.env)) return response;
  const person = analyticsPersonId(access.user.id, ctx.env.CRON_SECRET);
  sendLater(() =>
    captureServer(ctx.env, ctx.fetch, [
      { event: "ws_action", person, properties: { feature, action } },
    ]),
  );
  return response;
}
