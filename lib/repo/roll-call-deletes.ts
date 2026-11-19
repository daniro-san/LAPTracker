// A roll call's own parts of its delete (issue 424, D120) and its archive. The delete and its Undo are the
// shared soft delete (./trash, D123); this file adds the roll call's Undo rule, and who archived it and when.
import { and, eq, isNull, sql } from "drizzle-orm";

import type { Db } from "../db";
import { rollCalls } from "../schema";
import { live } from "./roll-call";

export interface CallChange {
  workspaceId: number;
  id: number;
  userId: number;
  now: Date;
}

const mine = (c: CallChange) =>
  and(eq(rollCalls.workspaceId, c.workspaceId), eq(rollCalls.id, c.id));

/**
 * The roll call's Undo rule (D120): no new live roll call took the deleted one's place meanwhile (the same
 * Calendar week, or the same kind and day added by hand).
 */
export const placeFree = sql`not exists (select 1 from roll_calls o
  where o.deleted_at is null and o.id <> ${rollCalls.id}
    and ((o.entry_id = ${rollCalls.entryId} and o.week = ${rollCalls.week})
      or (${rollCalls.requestId} is not null and o.request_id is not null
        and o.workspace_id = ${rollCalls.workspaceId} and o.kind = ${rollCalls.kind}
        and o.day = ${rollCalls.day})))`;

/**
 * Archives (`on`) or unarchives a live roll call (D120). Archiving keeps the first officer's who and when;
 * a repeat is true without writing. False when the workspace has no such live roll call.
 */
export async function setCallArchived(db: Db, c: CallChange & { on: boolean }): Promise<boolean> {
  const [done] = await db
    .update(rollCalls)
    .set(
      c.on ? { archivedAt: c.now, archivedBy: c.userId } : { archivedAt: null, archivedBy: null },
    )
    .where(and(mine(c), live, ...(c.on ? [isNull(rollCalls.archivedAt)] : [])))
    .returning({ id: rollCalls.id });
  if (done) return true;
  const [found] = await db
    .select({ id: rollCalls.id })
    .from(rollCalls)
    .where(and(mine(c), live));
  return found !== undefined;
}
