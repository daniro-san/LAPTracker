// The tick's officers' notifications (D148), after its answer: the night's roster read that failed after its
// retry, and the Calendar roll calls' reminders. No new cron and no extra wake of the database: they run on
// the ticks that open it anyway (D141), and a reminder stays due for 3 hours, the longest gap between them
// (the heartbeat). The roll calls are read through lib/private/push-roll-calls.ts, the one lib/private module
// this file may import (D148): the same counts the Roll call page shows, never a name.
import type { AppContext } from "./app-context";
import type { Db } from "./db";
import { dueRollCalls } from "./private/push-roll-calls";
import { notifyOfficers, pushConfig, pushLater } from "./push";
import { pushNightRead, type UseDeps } from "./push-uses";
import { claimPushMark, workspacesWithUse } from "./repo/push";
import type { TickOutcome } from "./tick";
import { fill } from "./words";

/** Each Calendar roll call's reminder that is due now, once ("open", then "left"), to its officers. */
export async function rollCallReminders(deps: UseDeps, db: Db): Promise<void> {
  const now = deps.now();
  for (const ws of await workspacesWithUse(db, "roll_call", now)) {
    for (const r of await dueRollCalls(db, ws, now, deps.env)) {
      const mark = { workspaceId: ws.id, key: r.key, value: r.phase };
      if (!(await claimPushMark(db, mark, now))) continue;
      await notifyOfficers(deps, db, ws.id, "roll_call", (w) => {
        const open = r.kind === "shield" ? w.rollOpenShield : w.rollOpen;
        return {
          title: fill(w.rollTitle, {
            name: fill(w.kinds[r.kind], { team: r.variant ?? "" }).trim(),
          }),
          body: fill(r.phase === "open" ? open : w.rollLeft, { n: r.notSet }),
          url: r.url,
          tag: r.key,
        };
      });
    }
  }
}

/** After a tick that opened the database: the night read's notification when its retry fell short, then the
 * roll call reminders. Nothing at all without the site's push keys. */
export function schedulePushTick(ctx: AppContext, tick: TickOutcome): void {
  if (!pushConfig(ctx.env)) return;
  const deps: UseDeps = { env: ctx.env, fetch: ctx.fetch, now: ctx.now };
  if (tick.kind === "daily-read" && tick.retried && tick.summary.failed.length > 0) {
    const summary = tick.summary;
    pushLater(ctx, (db) => pushNightRead(deps, db, summary));
  }
  pushLater(ctx, (db) => rollCallReminders(deps, db));
}
