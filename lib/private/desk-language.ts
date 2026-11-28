// Alliance settings → Language (issue 438): the desk's language for a viewer who has not used the EN · PT · FR
// switch. Officers of the workspace only (`WorkspaceAccess`). The saved value is one of the three desk
// languages or none (null: follow the browser's Accept-Language, as before). The switch's cookie still wins.
import { z } from "zod";

import type { Db } from "../db";
import { recordFailure } from "../repo/auth-attempts";
import { defaultLanguageOf, saveDefaultLanguage } from "../repo/workspace-language";
import type { WorkspaceAccess } from "./access";
import { WORKSPACE_LANGUAGES, type WorkspaceLanguage } from "./dictionary";

/** At most this many saves per 15 minutes per workspace: far above an officer choosing. */
const SAVES = 60;
const WINDOW_MS = 15 * 60_000;

/** "" is "follow the browser". */
export const deskLanguageInput = z
  .object({ language: z.enum([...WORKSPACE_LANGUAGES, ""]) })
  .strict();
export type DeskLanguageInput = z.infer<typeof deskLanguageInput>;

/** The workspace's saved default; null for none, an unknown value or a slug with no workspace. */
export async function workspaceDefaultLanguage(
  db: Db,
  slug: string,
): Promise<WorkspaceLanguage | null> {
  const saved = await defaultLanguageOf(db, slug);
  return WORKSPACE_LANGUAGES.find((l) => l === saved) ?? null;
}

export type DeskLanguageResult = { ok: true } | { ok: false; code: "rate_limited" };

export async function saveDeskLanguageFor(
  db: Db,
  access: WorkspaceAccess,
  input: DeskLanguageInput,
  now: Date,
): Promise<DeskLanguageResult> {
  const tries = await recordFailure(db, `desk-language:ws:${access.workspaceId}`, WINDOW_MS, now);
  if (tries > SAVES) return { ok: false, code: "rate_limited" };
  await saveDefaultLanguage(db, access.workspaceId, input.language || null);
  return { ok: true };
}
