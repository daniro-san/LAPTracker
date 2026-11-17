// The members' board's read (D105, issue 331). It takes a BoardAccess, never a WorkspaceAccess, and returns
// only what members may see: the calendar entries an officer marked "Members can see this" (kind, title,
// time, notes, link; no caravan seats, no author), the notices marked "Show to members" whose end day has not
// passed (title, end day, text per language; no author), and Start here. Nothing about any person.
import type { Db } from "../db";
import { calendarRows } from "../repo/calendar";
import { newestNoticeValues } from "../repo/notices";
import { readStartHere } from "../repo/start-here";
import type { StartHereText } from "../schema-board";
import type { BoardAccess } from "./access";
import { layOut, type EntryRow } from "./calendar-model";
import { addDays, mondayOf } from "./calendar-time";
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
}

export interface BoardView {
  entries: BoardEntry[];
  notices: BoardNotice[];
  startHere: Partial<Record<NoticeLanguage, StartHereText>>;
}

/** Notices marked for members whose end day is not before `today` (a server day), newest change first. */
async function memberNotices(db: Db, workspaceId: number, today: string): Promise<BoardNotice[]> {
  const flags = await newestNoticeValues(db, workspaceId, ["for_members", "ends_on"]);
  const byId = new Map<number, { show: boolean; endsOn: string; at: Date }>();
  for (const f of flags) {
    const n = byId.get(f.noticeId) ?? { show: false, endsOn: "", at: f.updatedAt };
    if (f.field === "for_members") n.show = f.value === "true";
    if (f.field === "ends_on") n.endsOn = f.value;
    byId.set(f.noticeId, n);
  }
  const shown = [...byId]
    .filter(([, n]) => n.show && (n.endsOn === "" || n.endsOn >= today))
    .sort(([a, x], [b, y]) => y.at.getTime() - x.at.getTime() || b - a);
  const ids = shown.map(([id]) => id);
  const values = await newestNoticeValues(db, workspaceId, ["title", ...NOTICE_LANGUAGES], ids);
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
    return { id, title, endsOn: n.endsOn || null, texts, stale: staleOf(bases) };
  });
}

/** Everything the board shows, from `today` (a server day) through the six days after it. */
export async function boardView(db: Db, access: BoardAccess, today: string): Promise<BoardView> {
  const monday = mondayOf(today);
  const last = addDays(today, BOARD_DAYS - 1);
  const [{ entries, rows }, notices, record] = await Promise.all([
    calendarRows(db, access.workspaceId, monday, monday, last),
    memberNotices(db, access.workspaceId, today),
    readStartHere(db, access.workspaceId),
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
  };
}
