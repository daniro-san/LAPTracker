// Alliance settings → Raid Shield check (issue 474, D137): when Saturday's morning read starts (10:00 to
// 11:00 ST, every 15 minutes; never after 12:00 ST, when KvK starts) and whether the leaders' channel gets
// the check's summary, in which language. Officers only; the workspace comes from the session. Only while
// the check is on (D134): a turned-off feature has no settings to show (D126 amendment, issue 483).
import { z } from "zod";

import type { Db } from "../db";
import { recordFailure } from "../repo/auth-attempts";
import { saveShieldSettings, shieldSettingsOf } from "../repo/shield-checks";
import { MORNING_MAX, MORNING_MIN, morningMinuteOf } from "../shield-check";
import type { WorkspaceAccess } from "./access";
import { WORKSPACE_LANGUAGES, type WorkspaceLanguage } from "./dictionary";
import { featureOn } from "./features";

/** The morning read's start times offered: 10:00, 10:15 … 11:00 ST. */
export const MORNING_CHOICES = Array.from(
  { length: (MORNING_MAX - MORNING_MIN) / 15 + 1 },
  (_, i) => MORNING_MIN + i * 15,
);

/** At most this many saves per 15 minutes per workspace: far above a person changing a setting. */
const SAVES = 30;
const WINDOW_MS = 15 * 60_000;

export const shieldSettingsInput = z
  .object({
    morningMinute: z
      .number()
      .int()
      .refine((m) => MORNING_CHOICES.includes(m)),
    discord: z.boolean(),
    language: z.enum(WORKSPACE_LANGUAGES),
  })
  .strict();
export type ShieldSettingsInput = z.infer<typeof shieldSettingsInput>;

export interface ShieldSettingsView {
  morningMinute: number;
  discord: boolean;
  language: WorkspaceLanguage;
}

/** The alliance's choices, or the defaults (10:00, no message, the officer's language); null when off. */
export async function shieldSettingsView(
  db: Db,
  access: WorkspaceAccess,
  officerLanguage: WorkspaceLanguage,
): Promise<ShieldSettingsView | null> {
  if (!featureOn(access, "shield_check")) return null;
  const row = await shieldSettingsOf(db, access.workspaceId);
  return {
    morningMinute: morningMinuteOf(row?.morningMinute),
    discord: row?.discord ?? false,
    language: (row?.language as WorkspaceLanguage | undefined) ?? officerLanguage,
  };
}

export async function saveShield(
  db: Db,
  access: WorkspaceAccess,
  input: ShieldSettingsInput,
  now: Date,
): Promise<{ ok: true } | { ok: false; code: "turned_off" | "rate_limited" }> {
  if (!featureOn(access, "shield_check")) return { ok: false, code: "turned_off" };
  const tries = await recordFailure(db, `shield:ws:${access.workspaceId}`, WINDOW_MS, now);
  if (tries > SAVES) return { ok: false, code: "rate_limited" };
  await saveShieldSettings(db, {
    workspaceId: access.workspaceId,
    ...input,
    updatedBy: access.user.id,
    updatedAt: now,
  });
  return { ok: true };
}
