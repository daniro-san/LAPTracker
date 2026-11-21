// POST /api/admin/workspaces/features — /admin's feature switches (D126, D134), PIN only, with the PIN's rate
// limits:
//   {action: "switch", workspace_id, feature, on}      allow a feature for one workspace or not; null: default
//   {action: "cap", workspace_id, allowance, cap}       a daily cap (null: no cap; "default": back to it)
//   {action: "copy", workspace_id, from_id}             the owner's switches and caps of another workspace
//   {action: "pause", allowance, paused}                a paid allowance off for every workspace
//   {action: "default_switch", feature, on}             "Defaults for new alliances": one switch
//   {action: "default_cap", allowance, cap}             "Defaults for new alliances": one cap (null: no cap)
// Only overrides are stored: a workspace value set to its default is stored as no value, so it follows the
// default when the default changes. Nothing is deleted: a feature turned off keeps its data. Each change
// counts as `ws_action` with feature `features` and no person (area admin).
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
  setDefault,
  setPaused,
  setSwitch,
  settingsById,
  type WorkspaceSettings,
} from "@/lib/repo/workspace-features";
import { errorResponse, withContext } from "@/lib/route";
import { changesCommands, syncCommands } from "@/lib/workspace-commands";
import { ALLOWANCES, copiedOverrides, FEATURES, type Feature } from "@/lib/workspace-features";

const id = z.number().int().positive();
const allowance = z.enum(ALLOWANCES);
const feature = z.enum(FEATURES as [Feature, ...Feature[]]);
const cap = z.number().int().min(0).max(999_999).nullable();
const body = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("switch"), workspace_id: id, feature, on: z.boolean().nullable() })
    .strict(),
  z
    .object({
      action: z.literal("cap"),
      workspace_id: id,
      allowance,
      cap: z.union([cap, z.literal("default")]),
    })
    .strict(),
  z.object({ action: z.literal("copy"), workspace_id: id, from_id: id }).strict(),
  z.object({ action: z.literal("pause"), allowance, paused: z.boolean() }).strict(),
  z.object({ action: z.literal("default_switch"), feature, on: z.boolean() }).strict(),
  z.object({ action: z.literal("default_cap"), allowance, cap }).strict(),
]);

/**
 * `{ok: true}`, counted as the owner's change, with the workspace it changed (none for a global pause or a
 * default); after the response, nothing when analytics is off.
 */
function done(ctx: AppContext, action: DeskAction, where?: EventWorkspace): Response {
  // D141: a switch may change the squads targets, so the ticks look at the queue again.
  ctx.wakeCache.forget();
  const event: ServerEvent = {
    event: "ws_action",
    properties: { feature: "features", action },
    ...(where && { where }),
  };
  sendLater(() => captureServer(ctx.env, ctx.fetch, [event]));
  return Response.json({ ok: true });
}

type Change = Extract<z.infer<typeof body>, { workspace_id: number }>;

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
    const overrides = copiedOverrides(from.settings, target.defaults);
    return (await copySettings(db, b.workspace_id, overrides, now))
      ? { action: "copy", where }
      : 404;
  }
  const action =
    b.action === "cap"
      ? await capChange(db, b, target, now)
      : await switchChange(db, b, target, now);
  return action ? { action, where } : 404;
}

/** D134: a cap equal to the default is no override; "default" puts it back. Null: no such workspace. */
async function capChange(
  db: Db,
  b: Extract<Change, { action: "cap" }>,
  target: WorkspaceSettings,
  now: Date,
): Promise<DeskAction | null> {
  const value =
    b.cap === "default" || b.cap === target.defaults.caps[b.allowance] ? "reset" : b.cap;
  const capped = await setCap(db, b.workspace_id, b.allowance, value, now);
  if (!capped) return null;
  return b.cap === "default" ? "reset" : "cap";
}

/** D134: allowing what the default allows (or the reverse) is no override; null puts it back. */
async function switchChange(
  db: Db,
  b: Extract<Change, { action: "switch" }>,
  target: WorkspaceSettings,
  now: Date,
): Promise<DeskAction | null> {
  const isDefault = b.on === null || b.on === !target.defaults.off.includes(b.feature);
  const switched = await setSwitch(db, b.workspace_id, b.feature, isDefault ? null : b.on, now);
  if (!switched) return null;
  if (b.on === null) return "reset";
  return b.on ? "turn_on" : "turn_off";
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
    if (b.action === "default_switch" || b.action === "default_cap") {
      if (b.action === "default_switch") await setDefault(db, "switches", b.feature, b.on, now);
      else await setDefault(db, "caps", b.allowance, b.cap, now);
      await commandsFollow(ctx, db, b, now);
      return done(ctx, "default");
    }
    const result = await change(db, b, now);
    if (result === 400) return errorResponse(400, "bad_request");
    if (result === 404) return errorResponse(404, "workspace_not_found");
    await commandsFollow(ctx, db, b, now);
    return done(ctx, result.action, result.where);
  });
}

/**
 * D129, issue 483: after a change that can add or remove a Discord command, each server that had the app's
 * commands gets exactly those now on, so a command turned off disappears from Discord. A server that never
 * had them is left alone; Discord refusing or not answering leaves the change saved (the interactions
 * route still answers a stale command with its "turned off" line). A pause or a default reaches every
 * workspace; a workspace's own change only that one.
 */
async function commandsFollow(ctx: AppContext, db: Db, b: z.infer<typeof body>, now: Date) {
  if (!changesCommands(b)) return;
  const scope = "workspace_id" in b ? { only: [b.workspace_id] } : {};
  await syncCommands(db, { env: ctx.env, fetch: ctx.fetch, now }, { ...scope, registered: true });
}
