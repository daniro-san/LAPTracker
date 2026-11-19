// "Delete this workspace" and "Cancel the deletion" (D125, issue 441), as an officer does them in Alliance
// settings and on the banner. The workspace comes from the session (WorkspaceAccess), never from the
// request; the address the officer typed must be this workspace's. Each one is claimed under its request
// id (D100), so a retry records nothing twice, and each that changed something gives Home one line.
import { z } from "zod";

import type { Db } from "../db";
import { claimDataEvent, dropDataEvent } from "../repo/workspace-data";
import { askDeletion, cancelDeletion } from "../repo/workspace-purge";
import type { WorkspaceAccess } from "./access";

export { DELETION_GRACE_MS } from "../repo/workspace-purge";

export const deletionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ask"), address: z.string().max(64), requestId: z.uuid() }).strict(),
  z.object({ action: z.literal("cancel"), requestId: z.uuid() }).strict(),
]);
export type DeletionInput = z.infer<typeof deletionInput>;

/** The deletion as it stands: when the daily job deletes the workspace, or null when none is asked. */
export type DeletionResult =
  { ok: true; purgeAfter: Date | null } | { ok: false; code: "address_mismatch" };

/**
 * Asks to delete the workspace, 14 days from now, when `address` is its own (spaces and case aside). A
 * deletion already asked stays as it is, and records no second line.
 */
export async function askToDelete(
  db: Db,
  access: WorkspaceAccess,
  input: Extract<DeletionInput, { action: "ask" }>,
  now: Date,
): Promise<DeletionResult> {
  if (input.address.trim().toLowerCase() !== access.slug) {
    return { ok: false, code: "address_mismatch" };
  }
  const event = { workspaceId: access.workspaceId, by: access.user.id, at: now };
  const claimed = await claimDataEvent(db, {
    ...event,
    action: "delete_asked",
    requestId: input.requestId,
  });
  const done = await askDeletion(db, access.workspaceId, access.user.id, now);
  if (claimed && !done?.asked) await dropDataEvent(db, access.workspaceId, input.requestId);
  return { ok: true, purgeAfter: done?.purgeAfter ?? null };
}

/** Cancels the deletion; any officer may. Nothing asked: nothing changes, and no line is recorded. */
export async function cancelToDelete(
  db: Db,
  access: WorkspaceAccess,
  input: Extract<DeletionInput, { action: "cancel" }>,
  now: Date,
): Promise<DeletionResult> {
  const claimed = await claimDataEvent(db, {
    workspaceId: access.workspaceId,
    by: access.user.id,
    at: now,
    action: "delete_cancelled",
    requestId: input.requestId,
  });
  const cancelled = await cancelDeletion(db, access.workspaceId);
  if (claimed && !cancelled) await dropDataEvent(db, access.workspaceId, input.requestId);
  return { ok: true, purgeAfter: null };
}
