"use client";

// The Members list (issue 337, D98): compact rows, 25 at a time with "Show more", an instant name search
// and two chips in a slim sticky block, and the rest in the "Filter and order" sheet. Everything runs in
// the browser over the rows the page sent; filters and the order are kept in the address (a reload or a
// shared link shows the same list), and only the order is remembered on this browser. In the default
// order, Check in and Needs help come first under their own heading. A row opens the member: in the
// sheet below 1024, in the pane beside the list from 1024 (MembersRoster, D122). Below 640 the rows are
// cards; from 640 each group is a table whose columns grow with the width (ResponsiveTable), Up and Down
// step through the rows, and from 1024 the row the focus lands on opens.
import { useState } from "react";

import {
  ResponsiveTable,
  type Column as TableColumn,
} from "@/lib/brand/components/layout/ResponsiveTable";
import { fill, isolate } from "@/lib/copy";
import { clockIn, hhmm } from "@/lib/private/calendar-time";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";
import {
  orderMembers,
  pastMatch,
  type MemberQuery,
  type Order,
  type Who,
} from "@/lib/private/members-list";

import type { ListRow, ListWords } from "./member-list-data";
import { MemberCell, MemberListRow, toAskText, type Column, type RowProps } from "./MemberListRow";
import { useMembersList, type ListState } from "./members-list-state";
import { MembersFilters } from "./MembersFilters";
import { CountLine, Empty, More, StickyBar } from "./MembersListParts";
import { stepRow } from "./open-member";
import { useMinute } from "./YourTime";

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

const languageNames = new Map<string, Intl.DisplayNames>();
/** A language's name in the officer's language; one formatter per language. */
function langName(code: string, language: WorkspaceLanguage) {
  let names = languageNames.get(language);
  if (!names) {
    names = new Intl.DisplayNames([language], { type: "language" });
    languageNames.set(language, names);
  }
  return names.of(code) ?? code;
}

export interface MembersListProps {
  rows: ListRow[];
  words: ListWords;
  language: WorkspaceLanguage;
  /** From the address the page was opened with. */
  initialQuery: MemberQuery;
  initialOrder: Order | null;
  /** The server day and hour when the page was made; the server's zone. */
  today: string;
  hour: number;
  serverZone: string;
  /** Before the first end-of-day read: Check in, Needs help and New show "—" (D75). */
  early: boolean;
  /** "Copy for spreadsheet"'s header row. */
  sheetHeader: string;
}

/** The open member, kept by the page's roster (`?m=`, D122). */
export interface OpenProps {
  open: number | null;
  /** From 1024 (null until the browser says). */
  wide: boolean | null;
  onOpen: (uid: number, step?: boolean) => void;
}

const WHO_KEY: Record<Who, keyof ListWords> = {
  checkin: "status.checkin",
  help: "status.help",
  break: "status.break",
  new: "members.new",
};

/** Every filter on, and the order, in words for the count line. */
function pillsOf(s: ListState, t: ListWords, language: WorkspaceLanguage): string[] {
  const { time, ask, who, lang } = s.query;
  const n = s.kept.length;
  return [
    s.query.r4 && t["members.filter.r4"],
    ask === "any" && t["list.ask"],
    ask === "timeZone" && fill(t["list.pill.noZone"], { n }),
    ask === "languages" && fill(t["list.pill.noLang"], { n }),
    who && t[WHO_KEY[who]],
    time &&
      fill(t[time.mode === "day" ? "list.pill.day" : "list.pill.night"], {
        time: hhmm(time.hour * 60),
      }),
    lang && langName(lang, language),
    s.order !== "rank" && fill(t["list.order.line"], { order: t[`list.order.${s.order}`] }),
  ].filter((p): p is string => typeof p === "string");
}

/** One row's props with its second lines: the past name the search found, what to ask, their time. */
function useRows(s: ListState, props: MembersListProps & OpenProps) {
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
  return (r: ListRow, index: number): RowProps => {
    const was = pastMatch(r, s.query.q);
    return {
      row: r,
      column: COLUMN[s.order],
      words: t,
      was: was && fill(t["list.was"], { name: isolate(was) }),
      toAsk: s.query.ask ? toAskText(r, t) : null,
      theirTime: theirTime(r),
      index,
      sheet: props.wide !== true,
      onOpen: () => props.onOpen(r.uid),
    };
  };
}

const NUMBERS: Column[] = ["might", "kills", "squad"];

/** The name; the order's number and the week's donations always; the other two numbers from 1440. The
 * numbers' widths are set, so the groups' tables line up one under another. */
function columnsOf(column: Column, t: ListWords): TableColumn<RowProps>[] {
  const number = (c: Column, wide: boolean): TableColumn<RowProps> => ({
    key: c,
    head: t[`list.col.${c}`],
    cell: (p) => <span className="whitespace-nowrap">{p.row.text[c]}</span>,
    numeric: true,
    width: c === "squad" ? "w-28" : "w-20",
    ...(wide && { priority: "wide" as const }),
  });
  return [
    { key: "name", head: t["tab.members"], cell: (p) => <MemberCell {...p} /> },
    number(column, false),
    {
      key: "donated",
      head: t["list.col.week"],
      cell: (p) => <span className="whitespace-nowrap">{p.row.text.donated}</span>,
      numeric: true,
      width: "w-20",
    },
    ...NUMBERS.filter((c) => c !== column).map((c) => number(c, true)),
  ];
}

/** One group of rows: cards below 640, a table from 640. */
function Group(p: { caption: string; rows: RowProps[]; open: number | null; t: ListWords }) {
  const column = p.rows[0]?.column ?? "might";
  return (
    <ResponsiveTable
      compact
      caption={p.caption}
      columns={columnsOf(column, p.t)}
      rows={p.rows}
      rowKey={(r) => String(r.row.uid)}
      card={(r) => <MemberListRow {...r} />}
      isOpen={(r) => r.row.uid === p.open}
      onRow={(r) => r.onOpen()}
    />
  );
}

/** The heading (Check in and Needs help) and the groups, within "Show more"'s depth. */
function Sections(p: {
  s: ListState;
  t: ListWords;
  row: ReturnType<typeof useRows>;
  open: number | null;
}) {
  const { s, t, row } = p;
  let left = s.depth;
  const take = (rows: ListRow[]) => {
    const start = s.depth - left;
    const shown = rows.slice(0, Math.max(0, left));
    left -= shown.length;
    return shown.map((r, i) => row(r, start + i));
  };
  const heading = take(s.heading);
  const label = (key: "main" | "none" | "break", n: number) =>
    key === "main"
      ? s.heading.length > 0
        ? t["list.rest"]
        : null
      : fill(t[key === "none" ? TAIL[s.order] : "list.tail.break"], { n });
  return (
    <>
      {heading.length > 0 && (
        <section aria-labelledby="ml-heading" className="mt-3">
          <h2 id="ml-heading" className="mb-1 font-subhead text-display-sm">
            {t["list.heading"]}
          </h2>
          <Group caption={t["list.heading"]} rows={heading} open={p.open} t={t} />
        </section>
      )}
      {s.groups.map((g) => {
        const shown = take(g.rows);
        if (shown.length === 0) return null;
        const head = label(g.key, g.rows.length);
        return (
          <section key={g.key} aria-label={head ?? undefined} className="mt-2">
            {head && <h2 className="mt-3 mb-1 text-body-sm font-semibold text-ink/80">{head}</h2>}
            <Group caption={head ?? t["tab.members"]} rows={shown} open={p.open} t={t} />
          </section>
        );
      })}
    </>
  );
}

/** What "Copy for spreadsheet" takes: the members on screen, in rank order when the order is low first. */
function copyText(s: ListState, header: string): string {
  const shown = [...s.heading, ...s.groups.flatMap((g) => g.rows)];
  const rows = s.order.endsWith("-asc") ? Object.values(orderMembers(shown, "rank")).flat() : shown;
  return [header, ...rows.map((r) => r.sheet)].join("\n");
}

export function MembersList(props: MembersListProps & OpenProps) {
  const { rows, words: t } = props;
  // The sheet frame gives each sheet its history entry: the phone's back button closes it.
  const [filters, setFilters] = useState(false);
  const s = useMembersList({ ...props, sheetOpen: filters });
  const row = useRows(s, props);
  const all = s.heading.length + s.groups.reduce((n, g) => n + g.rows.length, 0);
  return (
    // The table's head row sticks under the search bar (its height from 640: two 44 px rows, padding, rule).
    <div
      className="[--table-head-top:calc(7rem+1px)]"
      onKeyDown={(e) => {
        const uid = stepRow(e);
        if (uid !== null && props.wide) props.onOpen(uid, true);
      }}
    >
      <StickyBar s={s} t={t} column={COLUMN[s.order]} onFilters={() => setFilters(true)} />
      <CountLine
        s={s}
        t={t}
        total={rows.length}
        pills={pillsOf(s, t, props.language)}
        copy={copyText(s, props.sheetHeader)}
      />
      <Empty s={s} t={t} rows={rows} />
      <Sections s={s} t={t} row={row} open={props.open} />
      <More s={s} t={t} left={all - s.depth} />
      {filters && s.sheet && <Filters s={s} props={props} onClose={() => setFilters(false)} />}
    </div>
  );
}

function Filters(p: { s: ListState; props: MembersListProps; onClose: () => void }) {
  const { s, props } = p;
  const { rows } = props;
  return (
    <MembersFilters
      words={props.words}
      query={s.query}
      order={s.order}
      counts={s.sheet as NonNullable<ListState["sheet"]>}
      early={s.early}
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
      onClose={p.onClose}
    />
  );
}
