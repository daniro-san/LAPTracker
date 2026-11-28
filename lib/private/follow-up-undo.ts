// Follow-up's Undo (D104 amendment): appends "withdrawn", which cancels the member's newest record still
// counting, and puts back the fact that record wrote when nobody changed it since. Split from follow-up.ts,
// which re-exports `undoFollowUp`. Also a record deleted later from the member's history (D123 phase 2).
// Nothing here is logged.
import { and, eq } from "drizzle-orm";

import type { Db } from "../db";
import { factVersion } from "../repo/member-facts";
import {
  followUpRequested,
  insertMemberFollowUp,
  listMemberFollowUps,
  noWithdrawSince,
  stillCounting,
  type MemberFollowUp,
} from "../repo/member-follow-ups";
import { softDelete, undoDelete } from "../repo/trash";
import { memberFollowUps } from "../schema-followup";
import type { WorkspaceAccess } from "./access";
import type { FollowUpResult } from "./follow-up";
import { liveRecords } from "./follow-up-rules";
import { saveFacts, type FactChange } from "./member-facts";

const FIELD_OF = { break: "away", help: "status" } as const;

/**
 * Puts the fact a break or Needs help record wrote back to the version before, as a new version, while
 * that version is still the newest. The record wrote it only when both share the save's time: a save of
 * the value already there reuses the earlier version (`saveOne`), and Undo then leaves that value (#647).
 */
async function putBack(
  db: Db,
  access: WorkspaceAccess,
  record: MemberFollowUp & { action: "break" | "help"; factVersion: number },
  clock: { now: Date; zone: string },
): Promise<void> {
  const field = FIELD_OF[record.action];
  const where = [db, access.workspaceId, record.uid, field] as const;
  const newest = await factVersion(...where, "newest");
  if (newest?.version !== record.factVersion) return;
  // The record wrote this version only if both carry its save's clock.now (recordFollowUp passes one
  // instant to both); a reused version keeps the earlier save's time. Two requests in the same millisecond
  // could match by mistake.
  if (newest.writtenAt.getTime() !== record.at.getTime()) return;
  const before =
    record.factVersion > 1 ? await factVersion(...where, record.factVersion - 1) : null;
  const back = {
    field,
    version: record.factVersion,
    value: before?.value ?? null,
    source: "officer",
  };
  await saveFacts(db, access, record.uid, [back as FactChange], clock.now, clock.zone);
}

/**
 * Undo (D104 amendment): when `target` is still the member's newest record counting, appends "withdrawn"
 * so the member is back on the list. A break or Needs help it wrote is put back to the value before, as a
 * new version, unless another officer changed that fact since (then the fact stays as they left it). A
 * record that saved the value already there wrote no version, so its Undo leaves the fact as it is.
 */
export async function undoFollowUp(
  db: Db,
  access: WorkspaceAccess,
  input: { uid: number; target: string; requestId: string },
  clock: { now: Date; zone: string },
): Promise<FollowUpResult> {
  if (await followUpRequested(db, access.workspaceId, input.requestId)) return { ok: true };
  const live = liveRecords(await listMemberFollowUps(db, access.workspaceId, input.uid));
  const last = live.at(-1);
  if (!last || last.requestId !== input.target) return { ok: false, code: "not_found" };
  const { action, factVersion: version } = last;
  if (version !== null && (action === "break" || action === "help")) {
    await putBack(db, access, { ...last, action, factVersion: version }, clock);
  }
  await insertMemberFollowUp(db, {
    workspaceId: access.workspaceId,
    uid: input.uid,
    action: "withdrawn",
    writtenBy: access.user.id,
    writtenAt: clock.now,
    requestId: input.requestId,
  });
  return { ok: true };
}

/**
 * Deletes one of the member's records from their history (D123 phase 2), any officer, at any time; or with
 * `undo` takes the officer's own delete made under the same request id back within UNDO_MS. Only a record
 * still counting: a "withdrawn", or a record one cancelled, is not shown and so not deleted. Taking such a
 * record out leaves every other record counting as before, since no "withdrawn" ever cancelled it. A break
 * or Needs help it wrote stays on the card (member facts are corrected, never deleted). Undo is refused
 * once a "withdrawn" of the member came after the delete (`noWithdrawSince`). Both rules run inside the
 * write's own statement (`stillCounting`, `noWithdrawSince`), so a Follow-up Undo committed in between is
 * seen. "not_found" otherwise.
 */
export async function deleteFollowUp(
  db: Db,
  access: WorkspaceAccess,
  input: { uid: number; id: number; requestId: string; undo?: true | undefined },
  now: Date,
): Promise<FollowUpResult> {
  const { workspaceId, user } = access;
  const c = { workspaceId, userId: user.id, now, id: input.id, requestId: input.requestId };
  const ofMember = eq(memberFollowUps.uid, input.uid);
  const done = input.undo
    ? await undoDelete(db, memberFollowUps, c, and(ofMember, noWithdrawSince))
    : await softDelete(db, memberFollowUps, c, and(ofMember, stillCounting));
  return done ? { ok: true } : { ok: false, code: "not_found" };
}
