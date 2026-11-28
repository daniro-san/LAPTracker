// The members' game languages, counted for the notice editor (issue 794, D113 amendment 2026-11-28): a
// suggestion beside Translate, never applied. Counts only, no names; the language is the one the game
// reported on the alliance's own player reads (D132). A member with no language read is left out of the
// counts and only counted in the total (D75).
import type { Db } from "../db";
import { gameLanguages } from "../repo/player-reads";
import { latestRoster } from "../repo/workspace-rosters";
import type { WorkspaceAccess } from "./access";
import type { WorkspaceLanguage } from "./dictionary";
import { writingOff } from "./features";
import { DAY_MS } from "./member-week";
import { messageLanguage } from "./ready-message";

/** The window of reads the language is taken from: the newest read of each member inside it (#521). */
export const NOTICE_LANGUAGE_DAYS = 60;

export interface MemberLanguages {
  /** Members with a language read, and the members of the newest roster. */
  read: number;
  total: number;
  /** Members per workspace language, most first, none at zero. */
  counts: { language: WorkspaceLanguage; n: number }[];
  /** Members whose game language is not one the notices are written in. */
  other: number;
}

/** Counts the members' game language codes; `total` is the roster's size, `codes` those that have one. */
export function countLanguages(codes: readonly string[], total: number): MemberLanguages {
  const tally = new Map<WorkspaceLanguage, number>();
  let other = 0;
  for (const code of codes) {
    const language = messageLanguage([code]);
    if (language) tally.set(language, (tally.get(language) ?? 0) + 1);
    else other += 1;
  }
  const counts = [...tally].map(([language, n]) => ({ language, n })).sort((a, b) => b.n - a.n);
  return { read: codes.length, total, counts, other };
}

/**
 * The own alliance's members' game languages; null before a roster, with no language read, or while
 * Translate is off (D126: a help turned off is not there, so nothing is read for it).
 */
export async function memberLanguages(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
): Promise<MemberLanguages | null> {
  if (writingOff(access).includes("translate")) return null;
  const roster = await latestRoster(db, access.unionId);
  const since = new Date(now.getTime() - NOTICE_LANGUAGE_DAYS * DAY_MS);
  const game = await gameLanguages(
    db,
    access.unionId,
    roster.map((m) => m.uid),
    since,
  );
  const result = countLanguages([...game.values()], roster.length);
  return result.read === 0 ? null : result;
}
