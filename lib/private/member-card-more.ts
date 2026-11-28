// Two reads the member card adds beside its main one, apart from member-card.ts for its size: Alliance Duel by
// week (issue 467) and the usual hours line of the presence lines (issue 873, D163).
import type { Db } from "../db";
import { gameLanguageReads, lastSeenTimes } from "../repo/player-reads";
import { lastOnlineTimes } from "../repo/workspace-rosters";
import type { WorkspaceAccess } from "./access";
import { addDays, dayIn, mondayOf } from "./calendar-time";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import { duelHistory, duelTotals } from "./duel-history";
import { usualLine } from "./insights-usual-words";
import type { CardFormats, CardGameLanguage } from "./member-card";
import { duelCard, type DuelCard } from "./member-card-parts";
import { DAY_MS } from "./member-week";
import { NOTICE_LANGUAGE_DAYS } from "./notice-languages";
import { messageLanguage } from "./ready-message";
import { usualOf, USUAL_DAYS } from "./usual-hours";

interface At {
  now: Date;
  zone: string;
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
}

/**
 * Issue 467: Alliance Duel by week for one member and the alliance's average; null until a week of the
 * alliance has saved points. Reads this workspace's rows only.
 */
export async function cardDuelWeeks(
  db: Db,
  access: WorkspaceAccess,
  members: readonly { uid: number }[],
  uid: number,
  at: At,
  f: CardFormats,
): Promise<DuelCard | null> {
  const monday = mondayOf(dayIn(at.zone, at.now.getTime()));
  const totals = await duelTotals(db, access, monday);
  const weeks = duelHistory(totals, new Set(members.map((m) => m.uid)), uid, monday);
  return weeks && duelCard(weeks, at.t, f);
}

/** Issue 873, D163: the member's usual hours, from their presence readings of the last 30 days. */
export async function cardUsualLine(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  at: At,
): Promise<string> {
  const today = dayIn(at.zone, at.now.getTime());
  const since = new Date(at.now.getTime() - USUAL_DAYS * DAY_MS);
  // The own alliance's rows only.
  const [seen, online] = await Promise.all([
    lastSeenTimes(db, access.unionId, since, uid),
    lastOnlineTimes(db, access.unionId, uid, addDays(today, -USUAL_DAYS)),
  ]);
  const usual = usualOf(
    [...seen.map((s) => s.at), ...online].map((d) => d.getTime()),
    at.now,
    at.zone,
  );
  return usualLine(usual, { t: at.t, language: at.language });
}

/** The line "Game language: {name} (read {date})" from the newest read of the member's language, or null. */
export async function cardGameLanguage(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  at: { now: Date; t: WorkspaceDictionary },
  f: CardFormats,
): Promise<CardGameLanguage | null> {
  const since = new Date(at.now.getTime() - NOTICE_LANGUAGE_DAYS * DAY_MS);
  const read = (await gameLanguageReads(db, access.unionId, [uid], since)).get(uid);
  const t = at.t;
  return read
    ? {
        line: t["card.gameLanguage"],
        language: messageLanguage([read.language]),
        other: t["notices.langs.other"],
        date: f.date(read.readAt),
      }
    : null;
}
