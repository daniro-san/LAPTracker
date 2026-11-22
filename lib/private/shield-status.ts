// The Raid Shield check's line in the desk's read status bar (D135, D137): counts and server times only,
// never a member or a shield value (D71). Only while `shield_check` is on, and only for the quota day of
// the check (Friday's read) until KvK starts (Saturday 12:00 ST). The newest read that started is shown:
// - running: "Checking Raid Shields · 40 of 101 · started 23:31 ST";
// - done (also a stopped morning read, which keeps what it read): "Raid Shield check 23:42 ST · 87 of 101
//   seen with a shield", at the newest answer's time.
// Friday's read is the squads queue (D132): it runs while that queue's day is running and 00:00 ST has not
// come; Saturday's runs while its `morning_status` is `running`.
// Both counts are of Raid prep's set (drilldown batch C, 2026-11-22): the roster's members with those away on
// the raid's Saturday left out (`membersOfRaid`, shared with the Discord summary and the officers'
// notification), which Raid prep's grid leaves out by the same rule. The away ones are said as a count
// ("· 3 away"), and the line links the week's Raid prep (`raidPrepUrl`, the notification's link). Both live in
// lib/raid-prep-fill.ts, which sends nothing, so lib/private never reaches the Discord or push senders (D71).
import { dateWords } from "../date-words";
import type { Db } from "../db";
import type { Env } from "../env";
import { membersOfRaid, raidPrepUrl } from "../raid-prep-fill";
import { getShieldCheck, shieldReadings, type ShieldCheckRow } from "../repo/shield-checks";
import { getSquadRead } from "../repo/squads";
import { quotaDayRead } from "../schedule";
import { kvkStart, passWindows, suggestionOf } from "../shield-check";
import { fill } from "../words";
import type { WorkspaceAccess } from "./access";
import type { WorkspaceDictionary } from "./dictionary";
import { featureOn } from "./features";

export interface ShieldStatus {
  /** When the read started (or its newest answer, once done), to sort the bar's lines. */
  at: number;
  running: boolean;
  text: string;
  /** The week's Raid prep, where the members counted are marked. */
  href: string;
  /** Seen with a shield (0 while running): the bucket "Raid prep ›" sends (`ws_drilldown_opened`). */
  on: number;
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
  const zone = env.SERVER_TZ;
  const [readings, raid, running] = await Promise.all([
    shieldReadings(db, access.unionId, w.from, w.to),
    membersOfRaid(db, access, day, zone),
    isRunning(db, check, now < w.to),
  ]);
  // Read only once the line is shown.
  const link = () => raidPrepUrl(db, { id: access.workspaceId, slug: access.slug }, day);
  const asked = new Set(raid.members.map((m) => m.uid).filter((uid) => !raid.away.has(uid)));
  const mine = readings.filter((r) => asked.has(r.uid));
  const members = asked.size;
  const away = raid.away.size;
  const awayText =
    away === 0
      ? ""
      : ` · ${fill(t[`status.shield.away.${away === 1 ? "one" : "other"}`], { n: away })}`;
  if (running) {
    const started = (check.morningStartedAt ?? check.nightAt) as Date;
    const at = clock(zone, started);
    const text = fill(t["status.shield.running"], { read: mine.length, members, at }) + awayText;
    return { at: started.getTime(), running, text, href: await link(), on: 0 };
  }
  if (mine.length === 0) return null;
  const last = new Date(Math.max(...mine.map((r) => r.readAt.getTime())));
  const on = mine.filter((r) => suggestionOf(r) === "on").length;
  const text = fill(t["status.shield.done"], { at: clock(zone, last), on, members }) + awayText;
  return { at: last.getTime(), running, text, href: await link(), on };
}

/** Saturday's read runs while its status is `running`; Friday's while the squads queue's day does. */
async function isRunning(db: Db, check: ShieldCheckRow, inWindow: boolean): Promise<boolean> {
  if (check.morningStartedAt) return check.morningStatus === "running";
  if (!inWindow) return false;
  return (await getSquadRead(db, check.day, check.unionId))?.status === "running";
}
