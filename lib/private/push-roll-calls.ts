// The roll call reminders' read (D148): which Calendar roll calls of one workspace are due a notification now,
// with the count of members not set, from the same read as the Roll call page (`weekItems`: away members left
// out, an Elixir Scramble team only its members). Counts only: no name or mark leaves here. Called by the
// tick (lib/push-tick.ts, the one module outside app/(private) that may import it, D148) on the access of one
// of the workspace's officers whose device is on for roll calls.
//
// A Calendar roll call is open for 24 hours around its activity's time A (its day and time, server time):
// Raid prep (the KvK shield) is checked before KvK, so it is open from A − 24 h until A; the others mark who
// took part, so they are open from A until A + 24 h. A reminder is due in the first 3 hours after it opens
// ("open", when anyone is not set) and in its last 3 hours ("left", when anyone is still not set). Three
// hours, because the tick opens the database at least once every 3 hours (D141's heartbeat), so every
// window gets a tick. The "open" notification carries no number (it would always be the whole roster).
// Raid prep is left out while the Raid Shield check is on: that check's own notification covers it.
import type { Db } from "../db";
import { officerOf } from "../repo/push";
import { serverDay, type ScheduleConfig } from "../schedule";
import { officerAccess } from "./access";
import { addDays, DAY_MS, mondayOf, zonedInstant } from "./calendar-time";
import { featureOn, featuresById } from "./features";
import type { RollKind } from "./roll-call-rules";
import { weekItems } from "./roll-call-view";

const HOUR_MS = 3_600_000;
/** How long a reminder stays due after its moment: the tick's longest gap with the database open. */
export const REMINDER_WINDOW_MS = 3 * HOUR_MS;
/** The roll calls answered before their activity; the others after it. */
const BEFORE: readonly RollKind[] = ["shield"];

export interface RollCallReminder {
  /** The push mark's key and value: one "open" and one "left" per roll call. */
  key: string;
  phase: "open" | "left";
  kind: RollKind;
  /** An Elixir Scramble's team. */
  variant: string | null;
  notSet: number;
  url: string;
}

/** Which reminder of a roll call at instant `at` is due at `now`, or null. */
export function reminderPhase(kind: RollKind, at: number, now: number): "open" | "left" | null {
  const opens = BEFORE.includes(kind) ? at - DAY_MS : at;
  const closes = opens + DAY_MS;
  if (now >= opens && now < opens + REMINDER_WINDOW_MS) return "open";
  if (now >= closes - REMINDER_WINDOW_MS && now < closes) return "left";
  return null;
}

/** The workspace's Calendar roll calls due a reminder at `now`, each with its count of members not set. */
export async function dueRollCalls(
  db: Db,
  ws: { id: number; slug: string; unionId: number; officer: number },
  now: Date,
  cfg: Pick<ScheduleConfig, "SERVER_TZ">,
): Promise<RollCallReminder[]> {
  const [officer, features] = await Promise.all([
    officerOf(db, ws.id, ws.officer),
    featuresById(db, ws.id),
  ]);
  if (!officer) return [];
  const access = officerAccess(ws, officer, features);
  // D134: the Roll call tab turned off sends no reminder.
  if (!featureOn(access, "roll_call")) return [];
  const today = serverDay(now, cfg);
  // An activity due a reminder falls within a day of now: the weeks of yesterday, today and tomorrow.
  const weeks = [...new Set([-1, 0, 1].map((d) => mondayOf(addDays(today, d))))];
  const items = (
    await Promise.all(weeks.map((w) => weekItems(db, access, w, cfg.SERVER_TZ)))
  ).flat();
  // While the Raid Shield check is on, its own notification covers Raid prep: no second, different count.
  const shieldCheck = featureOn(access, "shield_check");
  return items.flatMap((item): RollCallReminder[] => {
    if (!item.placed || !("entry" in item.occasion)) return [];
    if (item.kind === "shield" && shieldCheck) return [];
    const at = zonedInstant(item.day, item.placed.minute ?? 0, cfg.SERVER_TZ);
    const phase = reminderPhase(item.kind, at, now.getTime());
    if (!phase || item.tally.notSet === 0) return [];
    const { entry, week } = item.occasion;
    return [
      {
        key: `rc:${entry}:${week}`,
        phase,
        kind: item.kind,
        variant: item.variant,
        notSet: item.tally.notSet,
        url: `/w/${ws.slug}/roll-call/mark?entry=${entry}&week=${week}`,
      },
    ];
  });
}
