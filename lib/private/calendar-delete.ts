// Skipping, ending or deleting a calendar entry (issue 300), inside its own workspace. A delete that takes the
// whole entry is the shared soft delete (D123): the entry leaves every read and keeps its weeks, and the
// officer who deleted it can take it back for a short while.
import type { Db } from "../db";
import { findEntry, lockWeekRow, updateEntry, updateWeekRow } from "../repo/calendar";
import { softDelete, undoDelete } from "../repo/trash";
import { calendarEntries } from "../schema";
import type { WorkspaceAccess } from "./access";
import { firstWeek, inPlan, type EntryRow } from "./calendar-model";
import { addDays, isDay } from "./calendar-time";

type Scope = "all" | "one" | "after";

/** The delete takes the whole entry: `all`, a one-off, or a weekly one ended from its first week. */
const whole = (entry: EntryRow, scope: Scope, week: string) =>
  scope === "all" || !entry.weekly || (scope === "after" && week <= firstWeek(entry));

/**
 * Deletes: `all` the entry, `one` only its week (a weekly entry keeps its other weeks), `after` its week
 * and every later one (from its first week, that is the whole entry). The whole entry is a soft delete
 * under the question's request id (D123), answered "deleted" so the page offers Undo; `undo` takes the
 * officer's own delete back within UNDO_MS, unless a new theme took its week.
 */
export async function removeEntry(
  db: Db,
  access: WorkspaceAccess,
  request: {
    entry: number;
    scope: Scope;
    week: string;
    requestId: string;
    undo?: true | undefined;
  },
  now: Date,
): Promise<"ok" | "deleted" | "not_found"> {
  const { entry: id, scope, week, requestId } = request;
  const trash = { workspaceId: access.workspaceId, id, userId: access.user.id, requestId, now };
  if (request.undo) return (await undoDelete(db, calendarEntries, trash)) ? "ok" : "not_found";
  const entry = await findEntry(db, access.workspaceId, id);
  // A repeat of a delete that went through (D100) finds it gone, and answers the same again.
  if (!entry) return (await softDelete(db, calendarEntries, trash)) ? "deleted" : "not_found";
  if (scope !== "all" && (!isDay(week) || !inPlan(entry, week))) return "not_found";
  if (whole(entry, scope, week)) {
    return (await softDelete(db, calendarEntries, trash)) ? "deleted" : "not_found";
  }
  if (scope === "after") {
    await updateEntry(db, id, { lastWeek: addDays(week, -7) });
  } else {
    await db.transaction(async (tx) => {
      const row = await lockWeekRow(tx, access.workspaceId, id, week);
      await updateWeekRow(tx, row.id, { cancelled: true });
    });
  }
  return "ok";
}
