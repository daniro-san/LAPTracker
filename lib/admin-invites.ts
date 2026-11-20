// /admin's New alliances actions (D130, issue 453), behind POST /api/admin/invites (PIN). Not in lib/private:
// only app/(private) may import that (D71's fence), and /admin is not a workspace page.
//   create   a one-time link for a tracked alliance with no workspace
//   cancel   an open link stops working
//   approve  a request approved and its link made, in one transaction (approveRequest)
//   decline  a request declined, with an optional reason shown to them
// "create" and "approve" answer the link once; only its hash is stored. Every call also deletes what is 30 days
// past its decision or end.
import { z } from "zod";

import type { Db } from "./db";
import {
  approveRequest,
  cancelInvite,
  createInvite,
  decideRequest,
  findRequest,
  purgeOldInvites,
  takenWorkspaceKeys,
} from "./repo/alliance-invites";
import { isKnownAlliance } from "./repo/alliances";

const id = z.number().int().positive();
export const adminInviteInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      // D133: any alliance we know, checked in adminInviteAction.
      union_id: z.number().int().positive(),
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
export type AdminInviteInput = z.infer<typeof adminInviteInput>;

export type AdminInviteResult =
  | { ok: true; link?: string; expiresAt?: Date }
  | {
      ok: false;
      status: 400 | 404 | 409;
      code: "bad_request" | "not_found" | "decided" | "has_workspace";
    };

const hasWorkspace = async (db: Db, unionId: number) =>
  (await takenWorkspaceKeys(db)).some((w) => w.unionId === unionId);
const linkOf = (origin: string, credential: string) => `${origin}/api/w/invite/${credential}`;

/** "Create the invite link": an alliance we know (D133) with no workspace yet. */
async function create(
  db: Db,
  unionId: number,
  now: Date,
  origin: string,
): Promise<AdminInviteResult> {
  if (!(await isKnownAlliance(db, unionId))) return { ok: false, status: 400, code: "bad_request" };
  if (await hasWorkspace(db, unionId)) return { ok: false, status: 409, code: "has_workspace" };
  const made = await createInvite(db, unionId, now);
  return { ok: true, link: linkOf(origin, made.credential), expiresAt: made.expiresAt };
}

export async function adminInviteAction(
  db: Db,
  input: AdminInviteInput,
  now: Date,
  origin: string,
): Promise<AdminInviteResult> {
  await purgeOldInvites(db, now);
  if (input.action === "cancel") {
    if (await cancelInvite(db, input.invite_id, now)) return { ok: true };
    return { ok: false, status: 404, code: "not_found" };
  }
  if (input.action === "create") return create(db, input.union_id, now, origin);
  const req = await findRequest(db, input.request_id);
  if (!req) return { ok: false, status: 404, code: "not_found" };
  if (req.decision !== null) return { ok: false, status: 409, code: "decided" };
  if (input.action === "decline") {
    const reason = input.reason || null;
    const answer = { decision: "declined" as const, reason };
    if (await decideRequest(db, req.id, answer, now)) return { ok: true };
    return { ok: false, status: 409, code: "decided" };
  }
  if (await hasWorkspace(db, req.unionId)) return { ok: false, status: 409, code: "has_workspace" };
  const approved = await approveRequest(db, req.id, now);
  if (!approved.ok) return { ok: false, status: 409, code: "decided" };
  return { ok: true, link: linkOf(origin, approved.credential), expiresAt: approved.expiresAt };
}
