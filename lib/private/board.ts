// The members' board's read (D105, issue 331). It takes a BoardAccess, never a WorkspaceAccess, and returns
// only what members may see: the calendar entries an officer marked "Members can see this" (kind, title,
// time, notes, link; no caravan seats, no author), the notices marked "Show to members" whose end day has not
// passed (title, end day, text per language, its picture's address (D119); no author), and Start here.
// Nothing about any person, except the weekly thank-you an officer chose to put there (D114, amending D105):
// its text per language, its week and the officer's name as its signature; never a value, a ranking or who
// was left out. A viewer with an approved link (D142) also gets their own name when the card names them.
import type { Db } from "../db";
import { calendarRows } from "../repo/calendar";
import { ownName } from "../repo/me";
import { pictureFacts } from "../repo/notice-pictures";
import { newestNoticeValues } from "../repo/notices";
import { readStartHere } from "../repo/start-here";
import { boardThanks, type BoardThanksRow } from "../repo/thanks";
import type { StartHereText } from "../schema-board";
import { meAccess, type BoardAccess } from "./access";
import { layOut, type EntryRow } from "./calendar-model";
import { addDays, mondayOf } from "./calendar-time";
import { pictureView, type PictureView } from "./notice-picture-rules";
import { NOTICE_LANGUAGES, staleOf, type NoticeLanguage } from "./notice-rules";

/** How many days "This week" shows: today and the six after it. */
export const BOARD_DAYS = 7;

export interface BoardEntry {
  key: string;
  day: string;
  /** Server time in minutes; null for the week's Alliance Duel theme. */
  minute: number | null;
  entry: Pick<EntryRow, "kind" | "variant" | "level" | "title" | "notes" | "link">;
  /** The linked notice, only when members can see it too. */
  noticeId: number | null;
}

export interface BoardNotice {
  id: number;
  title: string;
  endsOn: string | null;
  /** The languages written, with their text. */
  texts: Partial<Record<NoticeLanguage, string>>;
  /** Written languages behind the newest one ("may be out of date", D81's basis). */
  stale: NoticeLanguage[];
  /** The notice's picture (D119), served by /img/notice/[id]. */
  picture: PictureView | null;
}

export interface BoardView {
  entries: BoardEntry[];
  notices: BoardNotice[];
  startHere: Partial<Record<NoticeLanguage, StartHereText>>;
  /** The weekly thank-you card, until the next one or a Take down (D114). */
  thanks: BoardThanksRow | null;
  /**
   * The viewer's own player name when the card names them (issue 772): only through an approved link
   * (meAccess, D142), from the newest roster's public names; null otherwise.
   */
  thanked: string | null;
}

/** The viewer's own name, when their approved link's player is one of the card's names. */
async function thankedName(db: Db, access: BoardAccess, thanks: BoardThanksRow | null) {
  const me = meAccess(access);
  if (!thanks || !me) return null;
  const name = await ownName(db, me.unionId, me.uid);
  return name !== null && thanks.names.includes(name) ? name : null;
}

/** The notices the board shows: marked for members, end day not before `today`; newest change first. */
async function shownNotices(db: Db, workspaceId: number, today: string) {
  const flags = await newestNoticeValues(db, workspaceId, ["for_members", "ends_on"]);
  const byId = new Map<number, { show: boolean; endsOn: string; at: Date }>();
  for (const f of flags) {
    const n = byId.get(f.noticeId) ?? { show: false, endsOn: "", at: f.updatedAt };
    if (f.field === "for_members") n.show = f.value === "true";
    if (f.field === "ends_on") n.endsOn = f.value;
    byId.set(f.noticeId, n);
  }
  return [...byId]
    .filter(([, n]) => n.show && (n.endsOn === "" || n.endsOn >= today))
    .sort(([a, x], [b, y]) => y.at.getTime() - x.at.getTime() || b - a);
}

/**
 * Whether the board shows this notice on `today` (D119).
 * INVARIANT board.picture-shown: a member reaches a notice's picture only while the board shows the notice.
 */
export async function boardShowsNotice(
  db: Db,
  access: BoardAccess,
  noticeId: number,
  today: string,
): Promise<boolean> {
  return (await shownNotices(db, access.workspaceId, today)).some(([id]) => id === noticeId);
}

/** Notices marked for members whose end day is not before `today` (a server day), newest change first. */
async function memberNotices(db: Db, workspaceId: number, today: string): Promise<BoardNotice[]> {
  const shown = await shownNotices(db, workspaceId, today);
  const ids = shown.map(([id]) => id);
  const [values, pictures] = await Promise.all([
    newestNoticeValues(db, workspaceId, ["title", ...NOTICE_LANGUAGES], ids),
    pictureFacts(db, workspaceId, ids),
  ]);
  return shown.map(([id, n]) => {
    const mine = values.filter((v) => v.noticeId === id);
    const texts: BoardNotice["texts"] = {};
    const bases: Partial<Record<NoticeLanguage, number | null>> = {};
    for (const language of NOTICE_LANGUAGES) {
      const row = mine.find((v) => v.field === language);
      const text = row?.value.trim();
      if (text) {
        texts[language] = text;
        bases[language] = row?.basis ?? null;
      }
    }
    const title = mine.find((v) => v.field === "title")?.value ?? "";
    const picture = pictures.get(id);
    return {
      id,
      title,
      endsOn: n.endsOn || null,
      texts,
      stale: staleOf(bases),
      picture: picture ? pictureView(picture) : null,
    };
  });
}

/** Everything the board shows, from `today` (a server day) through the six days after it. */
export async function boardView(db: Db, access: BoardAccess, today: string): Promise<BoardView> {
  const monday = mondayOf(today);
  const last = addDays(today, BOARD_DAYS - 1);
  const [{ entries, rows }, notices, record, thanks] = await Promise.all([
    calendarRows(db, access.workspaceId, monday, monday, last),
    memberNotices(db, access.workspaceId, today),
    readStartHere(db, access.workspaceId),
    boardThanks(db, access.workspaceId),
  ]);
  const visible = new Set(notices.map((n) => n.id));
  const placed = layOut(entries, rows, monday, last).filter(
    // This week's Alliance Duel theme sits on its Monday, which may have passed; it stays.
    (p) => p.entry.forMembers && (p.day >= today || (p.entry.kind === "duel" && p.week === monday)),
  );
  return {
    entries: placed.map((p) => ({
      key: `${p.entry.id}:${p.week}`,
      day: p.day,
      minute: p.minute,
      entry: {
        kind: p.entry.kind,
        variant: p.entry.variant,
        level: p.entry.level,
        title: p.entry.title,
        notes: p.entry.notes,
        link: p.entry.link,
      },
      noticeId:
        p.entry.noticeId !== null && visible.has(p.entry.noticeId) ? p.entry.noticeId : null,
    })),
    notices,
    startHere: record?.texts ?? {},
    thanks,
    thanked: await thankedName(db, access, thanks),
  };
}
