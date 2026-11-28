// Alliance settings → Raid Shield check (issue 474, D137): when the reads run (issue 859: the night read on
// Friday up to the reset, the morning read 10:00 to 11:00 ST, the after-reset check on or off and its time,
// every 15 minutes; never inside an event's window or another read's, never after 12:00 ST, when KvK
// starts) and whether the leaders' channel gets the check's summary, in which language. Officers only; the
// workspace comes from the session. Only while the check is on (D134): a turned-off feature has no settings
// to show (D126 amendment, issue 483).
import { z } from "zod";

import type { Db } from "../db";
import { latestMemberCounts } from "../queries/rosters";
import { raidSpans, raidTimesOf } from "../raid-opponent";
import { recordFailure } from "../repo/auth-attempts";
import { saveShieldSettings, shieldSettingsOf } from "../repo/shield-checks";
import type { ScheduleConfig } from "../schedule";
import { DEFAULT_TIMES, snapToTick, timeRanges, timesOf, timesRefusal } from "../shield-check";
import { ESTIMATE_MEMBERS } from "../workspace-features";
import type { WorkspaceAccess } from "./access";
import { WORKSPACE_LANGUAGES, type WorkspaceLanguage } from "./dictionary";
import { featureOn } from "./features";

/** At most this many saves per 15 minutes per workspace: far above a person changing a setting. */
const SAVES = 30;
const WINDOW_MS = 15 * 60_000;

/** A time as sent: minutes after 00:00 ST, moved to the next tick. */
const minute = z.number().int().min(0).max(1439).transform(snapToTick);

export const shieldSettingsInput = z
  .object({
    nightMinute: minute,
    morningMinute: minute,
    resetRead: z.boolean(),
    resetMinute: minute,
    discord: z.boolean(),
    language: z.enum(WORKSPACE_LANGUAGES),
  })
  .strict();
export type ShieldSettingsInput = z.infer<typeof shieldSettingsInput>;

export interface ShieldSettingsView {
  nightMinute: number;
  morningMinute: number;
  resetRead: boolean;
  resetMinute: number;
  discord: boolean;
  language: WorkspaceLanguage;
}

/**
 * The alliance's choices, or the defaults (23:30, 10:00, after-reset on at 02:30, no message, the
 * officer's language), and the members the card's tracker estimate counts (the newest roster's, an
 * alliance's capacity before any read); null when off.
 */
export async function shieldSettingsView(
  db: Db,
  access: WorkspaceAccess,
  officerLanguage: WorkspaceLanguage,
): Promise<(ShieldSettingsView & { members: number }) | null> {
  if (!featureOn(access, "shield_check")) return null;
  const [row, counts] = await Promise.all([
    shieldSettingsOf(db, access.workspaceId),
    latestMemberCounts(db, [access.unionId]),
  ]);
  const times = timesOf(row);
  return {
    nightMinute: times.night,
    morningMinute: times.morning,
    resetRead: times.reset !== null,
    resetMinute: row?.resetMinute ?? (DEFAULT_TIMES.reset as number),
    discord: row?.discord ?? false,
    language: (row?.language as WorkspaceLanguage | undefined) ?? officerLanguage,
    members: counts.get(access.unionId) ?? ESTIMATE_MEMBERS,
  };
}

export async function saveShield(
  db: Db,
  access: WorkspaceAccess,
  input: ShieldSettingsInput,
  ctx: { env: ScheduleConfig; now: Date },
): Promise<
  | { ok: true }
  | {
      ok: false;
      code: "turned_off" | "rate_limited" | "out_of_range" | "event_window" | "reads_overlap";
    }
> {
  if (!featureOn(access, "shield_check")) return { ok: false, code: "turned_off" };
  const tries = await recordFailure(db, `shield:ws:${access.workspaceId}`, WINDOW_MS, ctx.now);
  if (tries > SAVES) return { ok: false, code: "rate_limited" };
  const ranges = timeRanges(ctx.env);
  const inRange =
    ranges.night.includes(input.nightMinute) &&
    ranges.morning.includes(input.morningMinute) &&
    ranges.reset.includes(input.resetMinute);
  if (!inRange) return { ok: false, code: "out_of_range" };
  const times = {
    night: input.nightMinute,
    morning: input.morningMinute,
    reset: input.resetRead ? input.resetMinute : null,
  };
  // Issue 861: the raid opponent's reads at the alliance's times may not meet these either.
  const raid = raidTimesOf(await shieldSettingsOf(db, access.workspaceId));
  const refused = timesRefusal(times, ctx.env, ctx.now, (day) => raidSpans(day, ctx.env, raid));
  if (refused) return { ok: false, code: refused };
  await saveShieldSettings(db, {
    workspaceId: access.workspaceId,
    ...input,
    updatedBy: access.user.id,
    updatedAt: ctx.now,
  });
  return { ok: true };
}
