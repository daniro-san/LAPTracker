// "Share the thanks" (issue 404, D114): what the thanks box hands the sheet, made on the server in the
// officer's language. The week's list (D109's progress, weekly baseline) comes ticked, with what each person
// did in words; the roster's names let the officer add someone. No value, no ranking (D75).
import { getAppContext } from "@/lib/app-context";
import { fill } from "@/lib/copy";
import { addDays, mondayOf } from "@/lib/private/calendar-time";
import { calendarDates } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { shareEn } from "@/lib/private/dictionary.share";
import { thanksWeek } from "@/lib/private/fact-trend";
import { progressText } from "@/lib/private/member-card";
import type { MembersView } from "@/lib/private/members";
import { NOTE_LIMIT } from "@/lib/private/thanks";

import { SHEET_KEYS } from "./sheet-words";

const SHARE_KEYS = [
  ...(Object.keys(shareEn).filter((k) => k.startsWith("share.")) as (keyof typeof shareEn)[]),
  ...SHEET_KEYS,
  // D126: the alliance's daily limit for writing help is used up.
  "features.cap.ai" as const,
];
export type ShareWords = Pick<WorkspaceDictionary, (typeof SHARE_KEYS)[number]>;

/** One person the post may name: what they did ("squad", "ad"), and the same in words. */
export interface SharePerson {
  uid: number;
  name: string;
  did: ("squad" | "ad")[];
  line: string;
}

export interface ShareThanksProps {
  slug: string;
  words: ShareWords;
  /** The officer's language: its text opens first. */
  language: WorkspaceLanguage;
  /** The week thanked: its Monday, its dates, and whether it is last week's (a Monday, D114). */
  week: { monday: string; range: string; lastWeek: boolean };
  people: SharePerson[];
  roster: { uid: number; name: string }[];
  /** The members' Discord channel's name, without "#"; null when none is set up. */
  channel: string | null;
  /** Writing help is on (GROQ_API_KEY, and the thanks draft's switch, D126). */
  ai: boolean;
  /** The members' board is on for the alliance (D126): the sheet offers it. */
  board: boolean;
  /** The longest "few words about them" the draft takes. */
  noteLimit: number;
}

/** "Nov 16 – Nov 22": the week that starts on `monday`, in the officer's language. */
export function weekRange(monday: string, t: WorkspaceDictionary, language: WorkspaceLanguage) {
  const { dayMonth } = calendarDates(language);
  return fill(t["share.range"], { from: dayMonth(monday), to: dayMonth(addDays(monday, 6)) });
}

/**
 * The switches the thanks sheet follows (D126), plain booleans so they reach client components, and the
 * members' Discord channel's name (D129: read with the page's data, never its webhook).
 */
export interface ThanksSwitches {
  board: boolean;
  writing: boolean;
  channel: string | null;
}

/** The sheet's props; the members' channel and the writing help come from the environment. */
export function shareThanksProps(p: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  view: MembersView;
  today: string;
  /** D126: the board and the thanks draft, as switched for the alliance. */
  switches: ThanksSwitches;
}): ShareThanksProps {
  const { t } = p;
  const monday = thanksWeek(p.today);
  return {
    slug: p.slug,
    words: Object.fromEntries(SHARE_KEYS.map((k) => [k, t[k]])) as ShareWords,
    language: p.language,
    week: {
      monday,
      range: weekRange(monday, t, p.language),
      lastWeek: monday !== mondayOf(p.today),
    },
    people: p.view.thanks.progress.map((x) => ({
      uid: x.uid,
      name: x.name,
      did: [
        ...(x.squadGrowth !== null ? ["squad" as const] : []),
        ...(x.adDone ? ["ad" as const] : []),
      ],
      line: progressText(x, t),
    })),
    roster: p.view.members.map((m) => ({ uid: m.uid, name: m.name })),
    channel: p.switches.channel,
    ai: getAppContext().ai !== null && p.switches.writing,
    board: p.switches.board,
    noteLimit: NOTE_LIMIT,
  };
}
