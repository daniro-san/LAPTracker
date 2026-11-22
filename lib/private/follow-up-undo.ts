// Follow-up's Undo (D104 amendment): appends "withdrawn", which cancels the member's newest record still
// counting, and puts back the fact that record wrote when nobody changed it since. Split from follow-up.ts,
// which re-exports `undoFollowUp`. Nothing here is logged.
import type { Db } from "../db";
import { factVersion } from "../repo/member-facts";
import {
  followUpRequested,
  insertMemberFollowUp,
  listMemberFollowUps,
  type MemberFollowUp,
} from "../repo/member-follow-ups";
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
