"use client";

// The Members list (issue 337, D98): compact rows, 25 at a time with "Show more", an instant name search
// and two chips in a slim sticky block, and the rest in the "Filter and order" sheet. Everything runs in
// the browser over the rows the page sent; filters and the order are kept in the address (a reload or a
// shared link shows the same list), and only the order is remembered on this browser. In the default
// order, Check in and Needs help come first under their own heading. A row opens the member's sheet.
import { useSyncExternalStore } from "react";

import { fill } from "@/lib/copy";
import { clockIn, hhmm } from "@/lib/private/calendar-time";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";
import type { MemberQuery, Order } from "@/lib/private/members-list";

import type { ListRow, ListWords } from "./member-list-data";
import type { EditorContext } from "./MemberCards";
import { MemberListRow, toAskText, type Column } from "./MemberListRow";
import { useMembersList, type ListState } from "./members-list-state";
import { MembersFilters } from "./MembersFilters";
import { MemberSheet } from "./MemberSheet";
import { CountLine, Empty, More, StickyBar } from "./MembersListParts";
import { useHistorySheet } from "./sheet-history";

/** The current minute, after hydration only (the server renders no member's own time). */
function useMinute(): number | null {
  return useSyncExternalStore(
    (tick) => {
      const id = setInterval(tick, 20_000);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
}

const COLUMN: Record<Order, Column> = {
  rank: "might",
  might: "might",
  "might-asc": "might",
  kills: "kills",
  "kills-asc": "kills",
  squad: "squad",
};
const TAIL = {
  rank: "list.tail.rank",
  might: "list.tail.might",
  "might-asc": "list.tail.might",
  kills: "list.tail.kills",
  "kills-asc": "list.tail.kills",
  squad: "list.tail.squad",
} as const;

export function langName(code: string, language: WorkspaceLanguage) {
  try {
    return new Intl.DisplayNames([language], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export interface MembersListProps {
  rows: ListRow[];
  words: ListWords;
  language: WorkspaceLanguage;
  editor: EditorContext;
  /** From the address the page was opened with. */
  initialQuery: MemberQuery;
  initialOrder: Order | null;
  /** The server day and hour when the page was made; the server's zone. */
  today: string;
  hour: number;
  serverZone: string;
  /** "Copy for spreadsheet"'s header row. */
  sheetHeader: string;
}

/** The order, the time and the language in words, for the count line. */
function pillsOf(s: ListState, t: ListWords, language: WorkspaceLanguage): string[] {
  const time = s.query.time;
  return [
    time &&
      fill(t[time.mode === "day" ? "list.pill.day" : "list.pill.night"], {
        time: hhmm(time.hour * 60),
      }),
    s.query.lang && langName(s.query.lang, language),
    s.order !== "rank" && fill(t["list.order.line"], { order: t[`list.order.${s.order}`] }),
  ].filter((p): p is string => typeof p === "string");
}

/** The rows a group shows within "Show more"'s depth, and what each row's second line says. */
function useRows(s: ListState, props: MembersListProps, onOpen: (uid: number) => void) {
  const t = props.words;
  const minute = useMinute();
  const theirTime = (r: ListRow) => {
    if (r.zone === null) return null;
    const time = s.query.time;
    if (time)
      return fill(t["list.theirAt"], {
        time: hhmm(s.clock(r.zone, time.hour)),
        st: hhmm(time.hour * 60),
      });
    if (minute === null) return null;
    return fill(t["list.theirNow"], { time: clockIn(minute * 60_000, r.zone, props.today).time });
  };
  return (r: ListRow, index: number) => (
    <MemberListRow
      key={r.uid}
      row={r}
      column={COLUMN[s.order]}
      words={t}
      toAsk={s.query.ask ? toAskText(r, t) : null}
      theirTime={theirTime(r)}
      index={index}
      onOpen={() => onOpen(r.uid)}
    />
  );
}

function Groups({ s, t, row }: { s: ListState; t: ListWords; row: ReturnType<typeof useRows> }) {
  let left = s.depth;
  const label = (key: "main" | "none" | "break", n: number) =>
    key === "main"
      ? s.heading.length > 0
        ? t["list.rest"]
        : null
      : fill(t[key === "none" ? TAIL[s.order] : "list.tail.break"], { n });
  return s.groups.map((g) => {
    const start = s.depth - left;
    const take = g.rows.slice(0, Math.max(0, left));
    left -= take.length;
    if (take.length === 0) return null;
    const head = label(g.key, g.rows.length);
    return (
      <section key={g.key} aria-label={head ?? undefined} className="mt-2">
        {head && <h2 className="mt-3 text-body-sm font-semibold text-ink/80">{head}</h2>}
        <ul>{take.map((r, i) => row(r, start + i))}</ul>
      </section>
    );
  });
}

export function MembersList(props: MembersListProps) {
  const { rows, words: t } = props;
  const s = useMembersList(props);
  const filters = useHistorySheet<true>();
  const member = useHistorySheet<number>();
  const row = useRows(s, props, member.show);
  const column = COLUMN[s.order];
  const all = [...s.heading, ...s.groups.flatMap((g) => g.rows)];
  const paged = all.length - s.heading.length;
  const open = rows.find((r) => r.uid === member.open);
  return (
    <>
      <StickyBar s={s} t={t} column={column} onFilters={() => filters.show(true)} />
      <CountLine
        s={s}
        t={t}
        total={rows.length}
        pills={pillsOf(s, t, props.language)}
        copy={[props.sheetHeader, ...all.map((r) => r.sheet)].join("\n")}
      />
      <Empty s={s} t={t} rows={rows} />
      {s.heading.length > 0 && (
        <section aria-labelledby="ml-heading" className="mt-3">
          <h2 id="ml-heading" className="font-subhead text-display-sm">
            {t["list.heading"]}
          </h2>
          <p className="text-body-sm text-ink/80">{t["list.headingLead"]}</p>
          <ul className="mt-1">{s.heading.map((r, i) => row(r, -1 - i))}</ul>
        </section>
      )}
      <Groups s={s} t={t} row={row} />
      <More s={s} t={t} left={paged - s.depth} />
      {filters.open && <Filters s={s} props={props} onClose={filters.hide} />}
      {open && (
        <MemberSheet
          row={open}
          version={rows}
          words={t}
          editor={props.editor}
          onClose={member.hide}
        />
      )}
    </>
  );
}

function Filters({
  s,
  props,
  onClose,
}: {
  s: ListState;
  props: MembersListProps;
  onClose: () => void;
}) {
  const { rows } = props;
  return (
    <MembersFilters
      words={props.words}
      query={s.query}
      order={s.order}
      counts={s.counts}
      total={rows.length}
      known={{
        squad: rows.filter((r) => r.squad !== null).length,
        zone: rows.filter((r) => r.zone !== null).length,
      }}
      languages={s.langs.map((code) => ({ code, name: langName(code, props.language) }))}
      hour={s.hour}
      today={props.today}
      serverZone={props.serverZone}
      shown={s.kept.length}
      onQuery={s.change}
      onOrder={s.choose}
      onHour={s.setHour}
      onClear={s.clearFilters}
      onClose={onClose}
    />
  );
}
