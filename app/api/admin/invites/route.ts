// POST /api/admin/invites — /admin's New alliances card (D130, issue 453). PIN only.
//   {action: "create", union_id}            a one-time link for a tracked alliance with no workspace
//   {action: "cancel", invite_id}           an open link stops working
//   {action: "approve", request_id}         a request approved: the same link, bound to its alliance
//   {action: "decline", request_id, reason} a request declined, with an optional reason shown to them
// "create" and "approve" answer the link once ({link, expires_at}); only its hash is stored. Every call also
// deletes what is 30 days past its decision or end.
import { z } from "zod";

import { ALLIANCES } from "@/config/alliances";
import { authorize } from "@/lib/auth";
import {
  cancelInvite,
  createInvite,
  decideRequest,
  findRequest,
  purgeOldInvites,
  takenWorkspaceKeys,
} from "@/lib/repo/alliance-invites";
import { errorResponse, withContext } from "@/lib/route";

const id = z.number().int().positive();
const body = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      union_id: z
        .number()
        .int()
        .refine((u) => ALLIANCES.some((a) => a.unionId === u)),
    })
    .strict(),
  z.object({ action: z.literal("cancel"), invite_id: id }).strict(),
  z.object({ action: z.literal("approve"), request_id: id }).strict(),
  z
    .object({
      action: z.literal("decline"),
      request_id: id,
      reason: z.string().trim().max(300).nullable(),
    })
    .strict(),
]);

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/invites", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const b = parsed.data;
    const now = ctx.now();
    await purgeOldInvites(db, now);
    const origin = new URL(request.url).origin;
    const link = async (unionId: number) => {
      const made = await createInvite(db, unionId, now);
      return { id: made.id, link: `${origin}/api/w/invite/${made.credential}`, made };
    };
    const hasWorkspace = async (unionId: number) =>
      (await takenWorkspaceKeys(db)).some((w) => w.unionId === unionId);
    if (b.action === "cancel") {
      if (!(await cancelInvite(db, b.invite_id, now))) return errorResponse(404, "not_found");
      return Response.json({ ok: true });
    }
    if (b.action === "create") {
      if (await hasWorkspace(b.union_id)) return errorResponse(409, "has_workspace");
      const made = await link(b.union_id);
      return Response.json({ link: made.link, expires_at: made.made.expiresAt.toISOString() });
    }
    const req = await findRequest(db, b.request_id);
    if (!req) return errorResponse(404, "not_found");
    if (req.decision !== null) return errorResponse(409, "decided");
    if (b.action === "decline") {
      await decideRequest(db, req.id, { decision: "declined", reason: b.reason || null }, now);
      return Response.json({ ok: true });
    }
    if (await hasWorkspace(req.unionId)) return errorResponse(409, "has_workspace");
    const made = await link(req.unionId);
    await decideRequest(db, req.id, { decision: "approved", inviteId: made.id }, now);
    return Response.json({ link: made.link, expires_at: made.made.expiresAt.toISOString() });
  });
}
