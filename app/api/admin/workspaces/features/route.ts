// POST /api/admin/workspaces/features — /admin's feature switches (D126), PIN only, with the PIN's rate limits:
//   {action: "switch", workspace_id, feature, on}      one feature on or off for one workspace
//   {action: "cap", workspace_id, allowance, cap}       a daily cap (null: no cap)
//   {action: "copy", workspace_id, from_id}             every switch and cap of another workspace
//   {action: "pause", allowance, paused}                a paid allowance off for every workspace
// Nothing is deleted: a feature turned off keeps its data. Each change counts as `ws_action` with feature
// `features` and no person (area admin).
import { z } from "zod";

import { captureServer, sendLater, type DeskAction } from "@/lib/analytics/server";
import type { AppContext } from "@/lib/app-context";
import { authorize } from "@/lib/auth";
import { changeSettings, setPaused, settingsById } from "@/lib/repo/workspace-features";
import { errorResponse, withContext } from "@/lib/route";
import { ALLOWANCES, capped, FEATURES, switched, type Feature } from "@/lib/workspace-features";

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

/** `{ok: true}`, counted as the owner's change (after the response; nothing when analytics is off). */
function done(ctx: AppContext, action: DeskAction): Response {
  const event = {
    event: "ws_action",
    properties: { feature: "features", action },
  } as const;
  sendLater(() => captureServer(ctx.env, ctx.fetch, [event]));
  return Response.json({ ok: true });
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
      return done(ctx, b.paused ? "pause" : "resume");
    }
    if (b.action === "copy") {
      if (b.from_id === b.workspace_id) return errorResponse(400, "bad_request");
      const from = await settingsById(db, b.from_id);
      if (!from) return errorResponse(404, "workspace_not_found");
      const copied = await changeSettings(db, b.workspace_id, () => from.settings, now);
      return copied ? done(ctx, "copy") : errorResponse(404, "workspace_not_found");
    }
    const changed = await changeSettings(
      db,
      b.workspace_id,
      (s) => (b.action === "switch" ? switched(s, b.feature, b.on) : capped(s, b.allowance, b.cap)),
      now,
    );
    if (!changed) return errorResponse(404, "workspace_not_found");
    return done(ctx, b.action === "cap" ? "cap" : b.on ? "turn_on" : "turn_off");
  });
}
