// The member card's Follow-up block (issue 516, amends D136): what was noted about the member this game
// week, whether they are on the week's Follow-up list, and the ready message Follow-up's panel shows (D140),
// with the words the card's browser part needs (the Members page has no Follow-up words of its own). People
// first (D75): "no follow-up note yet" only for a member on the list; a member off it with nothing noted
// gets no line. The workspace's own records and its own alliance's reads only (D71).
import { fill } from "../copy";
import type { Db } from "../db";
import { gameLanguages } from "../repo/player-reads";
import type { RosterRead } from "../repo/workspace-rosters";
import type { WorkspaceAccess } from "./access";
import { dayIn } from "./calendar-time";
import type { WorkspaceDictionary, WorkspaceKey, WorkspaceLanguage } from "./dictionary";
import { featureOn } from "./features";
import { LANGUAGE_DAYS, tipsOf, type followUpsOf } from "./follow-up";
import { historyLine, weekStart, worklist } from "./follow-up-rules";
import { DAY_MS } from "./member-week";
import type { MemberRow } from "./members";
import { inputOf, messageLanguage, readyTexts } from "./ready-message";

/** The words of Follow-up's message block ("A message you can send", the chips, the two copies). */
export const MESSAGE_KEYS = [
  "followup.message",
  "followup.messageHelp",
  "followup.messageLang",
  "followup.lang.en",
  "followup.lang.pt-BR",
  "followup.lang.fr",
  "followup.copyGame",
  "followup.copyDiscord",
  "followup.copied",
  "followup.copyFailed",
] as const satisfies readonly WorkspaceKey[];
export type MessageWords = Pick<WorkspaceDictionary, (typeof MESSAGE_KEYS)[number]>;

const CARD_KEYS = [
  ...MESSAGE_KEYS,
  "followup.talkedNow",
  "followup.undo",
  "followup.failed",
  "card.followup.open",
  "card.followup.saved",
  "card.followup.savedList",
  "card.followup.undone",
  "card.followup.undoChanged",
  "card.followup.undoFailed",
] as const satisfies readonly WorkspaceKey[];
export type CardFollowUpWords = Pick<WorkspaceDictionary, (typeof CARD_KEYS)[number]>;

export interface CardFollowUp {
  /** "This week: Talked Thu, Nov 19 · Ana", "This week: no follow-up note yet.", or null (nothing to say). */
  week: string | null;
  /** The note of this week's newest record, on its own line. */
  note: string | null;
  /** On the week's Follow-up list now: a Talked takes them off it until Monday. */
  onList: boolean;
  /** The ready message in each language, the member's first (else the officer's). */
  message: { language: WorkspaceLanguage; texts: Record<WorkspaceLanguage, string> };
  words: CardFollowUpWords;
}

type Records = Awaited<ReturnType<typeof followUpsOf>>;
type At = { now: Date; zone: string; language: WorkspaceLanguage; t: WorkspaceDictionary };

/** The officers' recorded languages first, then the game's from the alliance's own reads, else the officer's. */
async function languageOf(db: Db, access: WorkspaceAccess, member: MemberRow, at: At) {
  const since = new Date(at.now.getTime() - LANGUAGE_DAYS * DAY_MS);
  const game = await gameLanguages(db, access.unionId, [member.uid], since);
  const codes = [...(member.facts.languages?.value ?? []), game.get(member.uid) ?? null];
  return messageLanguage(codes) ?? at.language;
}

/**
 * "This week: Talked Thu, Nov 19 · Ana" and its note, from the newest record still counting since Monday
 * 00:00 ST; "no follow-up note yet" only while the member is on the list; otherwise nothing.
 */
function weekOf(records: Records, item: unknown, at: At, date: (at: Date | string) => string) {
  const start = weekStart(dayIn(at.zone, at.now.getTime()), at.zone);
  const newest = records.find((r) => r.at >= start);
  if (newest) {
    const line = historyLine({ ...newest, note: null }, at.t, date, date);
    return { week: fill(at.t["card.followup.week"], { line }), note: newest.note, onList: false };
  }
  const onList = item !== undefined;
  return { week: onList ? at.t["card.followup.none"] : null, note: null, onList };
}

/**
 * The card's Follow-up block, or null while the Follow-up tab is off (D126). `records`: the member's
 * records still counting, newest first (`followUpsOf`); `reads`: the end-of-day reads `membersView`
 * fetched (the coins tip's 7 days are among them).
 */
export async function cardFollowUp(
  db: Db,
  access: WorkspaceAccess,
  member: MemberRow,
  records: Records,
  reads: readonly RosterRead[],
  at: At,
  date: (at: Date | string) => string,
): Promise<CardFollowUp | null> {
  if (!featureOn(access, "follow_up")) return null;
  // The work item with this week's records not counted: the message stays the same after a Talked.
  const [item] = worklist([member], new Set(), tipsOf([member], reads));
  return {
    ...weekOf(records, item, at, date),
    message: {
      language: await languageOf(db, access, member, at),
      texts: readyTexts(
        inputOf(item ?? { member, checkIn: false, tip: false, toAsk: [], kvk: false }),
      ),
    },
    words: Object.fromEntries(CARD_KEYS.map((k) => [k, at.t[k]])) as CardFollowUpWords,
  };
}
