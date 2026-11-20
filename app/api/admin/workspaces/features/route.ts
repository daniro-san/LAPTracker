// POST /api/admin/workspaces/features — /admin's feature switches (D126), PIN only, with the PIN's rate limits:
//   {action: "switch", workspace_id, feature, on}      one feature on or off for one workspace
//   {action: "cap", workspace_id, allowance, cap}       a daily cap (null: no cap)
//   {action: "copy", workspace_id, from_id}             every switch and cap of another workspace
//   {action: "pause", allowance, paused}                a paid allowance off for every workspace
// Nothing is deleted: a feature turned off keeps its data. Each change counts as `ws_action` with feature
// `features` and no person (area admin).
import { z } from "zod";

import {
  captureServer,
  eventWorkspace,
  sendLater,
  type DeskAction,
  type EventWorkspace,
  type ServerEvent,
} from "@/lib/analytics/server";
import type { AppContext } from "@/lib/app-context";
import { authorize } from "@/lib/auth";
import type { Db } from "@/lib/db";
import {
  copySettings,
  setCap,
  setPaused,
  setSwitch,
  settingsById,
} from "@/lib/repo/workspace-features";
import { errorResponse, withContext } from "@/lib/route";
import { syncCommands } from "@/lib/workspace-commands";
import { ALLOWANCES, FEATURE_GROUPS, FEATURES, type Feature } from "@/lib/workspace-features";

const id = z.number().int().positive();
const allowance = z.enum(ALLOWANCES);
const body = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("switch"),
      workspace_id: id,
      feature: z.enum(FEATURES as [Feature, ...Feature[]]),
      on: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("cap"),
      workspace_id: id,
      allowance,
      cap: z.number().int().min(0).max(999_999).nullable(),
    })
    .strict(),
  z.object({ action: z.literal("copy"), workspace_id: id, from_id: id }).strict(),
  z.object({ action: z.literal("pause"), allowance, paused: z.boolean() }).strict(),
]);

/**
 * `{ok: true}`, counted as the owner's change, with the workspace it changed (none for a global pause);
 * after the response, nothing when analytics is off.
 */
function done(ctx: AppContext, action: DeskAction, where?: EventWorkspace): Response {
  const event: ServerEvent = {
    event: "ws_action",
    properties: { feature: "features", action },
    ...(where && { where }),
  };
  sendLater(() => captureServer(ctx.env, ctx.fetch, [event]));
  return Response.json({ ok: true });
}

type Change = Exclude<z.infer<typeof body>, { action: "pause" }>;

/**
 * One workspace's change, each one statement (D126): two quick taps never undo each other. The action to
 * count, or the status to refuse with (400 a copy onto itself, 404 no such workspace).
 */
async function change(
  db: Db,
  b: Change,
  now: Date,
): Promise<{ action: DeskAction; where: EventWorkspace } | 400 | 404> {
  const target = await settingsById(db, b.workspace_id);
  if (!target) return 404;
  const where = eventWorkspace(target);
  if (b.action === "copy") {
    if (b.from_id === b.workspace_id) return 400;
    const from = await settingsById(db, b.from_id);
    if (!from) return 404;
    return (await copySettings(db, b.workspace_id, from.settings, now))
      ? { action: "copy", where }
      : 404;
  }
  if (b.action === "cap") {
    const capped = await setCap(db, b.workspace_id, b.allowance, b.cap, now);
    return capped ? { action: "cap", where } : 404;
  }
  const action = b.on ? "turn_on" : "turn_off";
  return (await setSwitch(db, b.workspace_id, b.feature, b.on, now)) ? { action, where } : 404;
}

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/workspaces/features", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const b = parsed.data;
    const now = ctx.now();
    if (b.action === "pause") {
      await setPaused(db, b.allowance, b.paused, now);
      await commandsFollow(ctx, db, b, now);
      return done(ctx, b.paused ? "pause" : "resume");
    }
    const result = await change(db, b, now);
    if (result === 400) return errorResponse(400, "bad_request");
    if (result === 404) return errorResponse(404, "workspace_not_found");
    await commandsFollow(ctx, db, b, now);
    return done(ctx, result.action, result.where);
  });
}

const COMMAND_FEATURES: readonly Feature[] = FEATURE_GROUPS.discord;

/**
 * D129, issue 483: after a change that can add or remove a Discord command, each server that had the app's
 * commands gets exactly those now on, so a command turned off disappears from Discord. A server that never
 * had them is left alone; Discord refusing or not answering leaves the change saved (the interactions
 * route still answers a stale command with its "turned off" line).
 */
async function commandsFollow(ctx: AppContext, db: Db, b: z.infer<typeof body>, now: Date) {
  const touches =
    b.action === "copy" ||
    (b.action === "switch" && COMMAND_FEATURES.includes(b.feature)) ||
    (b.action === "pause" && b.allowance === "translate");
  if (!touches) return;
  const scope = b.action === "pause" ? {} : { only: [b.workspace_id] };
  await syncCommands(db, { env: ctx.env, fetch: ctx.fetch, now }, { ...scope, registered: true });
}
