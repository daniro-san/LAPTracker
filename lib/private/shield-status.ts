// The Raid Shield check's line in the desk's read status bar (D135, D137): counts and server times only,
// never a member or a shield value (D71). Only while `shield_check` is on, and only for the quota day of
// the check (Friday's read) until KvK starts (Saturday 12:00 ST). The newest read that started is shown:
// - running: "Checking Raid Shields · 40 of 101 · started 23:31 ST";
// - done (also a stopped morning read, which keeps what it read): "Raid Shield check 23:42 ST · 87 of 101
//   seen with a shield", at the newest answer's time.
// Friday's read is the squads queue (D132): it runs while that queue's day is running and 00:00 ST has not
// come; Saturday's runs while its `morning_status` is `running`.
import { fill } from "../copy";
import { dateWords } from "../date-words";
import type { Db } from "../db";
import type { Env } from "../env";
import { getShieldCheck, shieldReadings, type ShieldCheckRow } from "../repo/shield-checks";
import { dayRosterUids, getSquadRead } from "../repo/squads";
import { quotaDayRead } from "../schedule";
import { kvkStart, passWindows, suggestionOf } from "../shield-check";
import type { WorkspaceAccess } from "./access";
import type { WorkspaceDictionary } from "./dictionary";
import { featureOn } from "./features";

export interface ShieldStatus {
  /** When the read started (or its newest answer, once done), to sort the bar's lines. */
  at: number;
  running: boolean;
  text: string;
}

const clock = (zone: string, at: Date) => dateWords("en", zone).time(at);

/** The check's line now, or null: off, no read this quota day yet, nothing read, or KvK has started. */
export async function shieldStatus(
  db: Db,
  access: WorkspaceAccess,
  env: Env,
  now: Date,
  t: WorkspaceDictionary,
): Promise<ShieldStatus | null> {
  if (!featureOn(access, "shield_check")) return null;
  const day = quotaDayRead(now, env);
  const check = await getShieldCheck(db, { day, unionId: access.unionId });
  if (!check || now >= kvkStart(day, env)) return null;
  const pass = check.morningStartedAt ? "morning" : check.nightAt ? "night" : null;
  if (!pass) return null;
  const w = passWindows(day, env)[pass];
  const [readings, uids, running] = await Promise.all([
    shieldReadings(db, access.unionId, w.from, w.to),
    dayRosterUids(db, day, access.unionId),
    isRunning(db, check, now < w.to),
  ]);
  const members = uids?.length ?? 0;
  if (running) {
    const started = (check.morningStartedAt ?? check.nightAt) as Date;
    const at = clock(env.SERVER_TZ, started);
    const text = fill(t["status.shield.running"], { read: readings.length, members, at });
    return { at: started.getTime(), running, text };
  }
  if (readings.length === 0) return null;
  const last = new Date(Math.max(...readings.map((r) => r.readAt.getTime())));
  const on = readings.filter((r) => suggestionOf(r) === "on").length;
  const text = fill(t["status.shield.done"], { at: clock(env.SERVER_TZ, last), on, members });
  return { at: last.getTime(), running, text };
}

/** Saturday's read runs while its status is `running`; Friday's while the squads queue's day does. */
async function isRunning(db: Db, check: ShieldCheckRow, inWindow: boolean): Promise<boolean> {
  if (check.morningStartedAt) return check.morningStatus === "running";
  if (!inWindow) return false;
  return (await getSquadRead(db, check.day, check.unionId))?.status === "running";
}
