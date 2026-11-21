// POST /api/admin/workspaces {union_id, slug, discord_guild_id, leader_role_ids, member_role_ids} — /admin's
// Workspaces card (D71, D73, D105): registers an alliance's workspace, or edits it (one per alliance). PIN only. The
// alliance must be one we know (D133: on the ranks board or in a daily roster); Discord ids are snowflakes, kept
// as text.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { isKnownAlliance } from "@/lib/repo/alliances";
import { saveWorkspace, WORKSPACE_SLUG } from "@/lib/repo/workspaces";
import { errorResponse, withContext } from "@/lib/route";

const snowflake = z.string().regex(/^\d{17,20}$/);
const body = z
  .object({
    union_id: z.number().int().positive(),
    slug: z.string().regex(WORKSPACE_SLUG),
    discord_guild_id: snowflake,
    leader_role_ids: z.array(snowflake).min(1).max(20),
    // Empty: no member session, the members' board is closed (D105, amended 2026-11-17).
    member_role_ids: z.array(snowflake).max(20),
  })
  .strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/workspaces", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const b = parsed.data;
    if (!(await isKnownAlliance(db, b.union_id))) return errorResponse(400, "bad_request");
    const result = await saveWorkspace(db, {
      unionId: b.union_id,
      slug: b.slug,
      discordGuildId: b.discord_guild_id,
      leaderRoleIds: [...new Set(b.leader_role_ids)],
      memberRoleIds: [...new Set(b.member_role_ids)],
    });
    if (result !== "ok") return errorResponse(409, result);
    // D141: a new workspace can add a squads target, so the ticks look at the queue again.
    ctx.wakeCache.forget();
    return Response.json({ ok: true });
  });
}
