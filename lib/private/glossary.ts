// Alliance settings → Glossary (#832, D81 amendment 2026-11-28): words the alliance's translate, improve and
// fit requests never change (tags, nicknames, game words). Officers only; the whole list is saved at once, so
// the card's Undo is one more save of the list before. At most 100 words of 40 characters. Only while a
// translation feature is on (D126): off, the card is hidden, saves are refused and requests carry no list;
// the saved list stays. Words an officer typed, never members' text, and they never reach a log, analytics
// or an event.
import { z } from "zod";

import type { Db } from "../db";
import { cleanWords, GLOSSARY_MAX_CHARS, GLOSSARY_MAX_WORDS } from "../glossary";
import { recordFailure } from "../repo/auth-attempts";
import { glossaryOf, saveGlossary } from "../repo/glossary";
import type { WorkspaceAccess } from "./access";
import { featureOn } from "./features";

/** At most this many saves per 15 minutes per workspace: far above a person adding words. */
const SAVES = 60;
const WINDOW_MS = 15 * 60_000;

/** The features whose requests carry the glossary: the card shows while any of them is on. */
const TRANSLATING = [
  "notice_translate",
  "notice_improve",
  "notice_fit",
  "discord_translate_me",
  "discord_translate_everyone",
] as const;

/** Whether a translating feature is on for the workspace (both layers of D134 included). */
export const glossaryOn = (access: Pick<WorkspaceAccess, "features">) =>
  TRANSLATING.some((feature) => featureOn(access, feature));

/** The raw list is bounded at the boundary; its words are checked once cleaned. */
export const glossaryInput = z
  .object({ words: z.array(z.string().max(GLOSSARY_MAX_CHARS * 8)).max(GLOSSARY_MAX_WORDS * 2) })
  .strict();
export type GlossaryInput = z.infer<typeof glossaryInput>;

/** The workspace's saved words, for a request that is allowed to carry them. */
export const glossaryWords = (db: Db, workspaceId: number) => glossaryOf(db, workspaceId);

/** The card's words; null while no translating feature is on. */
export async function glossaryView(db: Db, access: WorkspaceAccess): Promise<string[] | null> {
  return glossaryOn(access) ? glossaryOf(db, access.workspaceId) : null;
}

export type GlossaryResult =
  | { ok: true; words: string[] }
  | { ok: false; code: "turned_off" | "invalid" | "too_many" | "rate_limited" };

export async function saveGlossaryFor(
  db: Db,
  access: WorkspaceAccess,
  input: GlossaryInput,
  now: Date,
): Promise<GlossaryResult> {
  if (!glossaryOn(access)) return { ok: false, code: "turned_off" };
  const words = cleanWords(input.words);
  if (words === null) return { ok: false, code: "invalid" };
  if (words.length > GLOSSARY_MAX_WORDS) return { ok: false, code: "too_many" };
  const tries = await recordFailure(db, `glossary:ws:${access.workspaceId}`, WINDOW_MS, now);
  if (tries > SAVES) return { ok: false, code: "rate_limited" };
  await saveGlossary(db, {
    workspaceId: access.workspaceId,
    words,
    updatedBy: access.user.id,
    updatedAt: now,
  });
  return { ok: true, words };
}
