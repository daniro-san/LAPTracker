"use client";

// The Members list (issue 337, D98): compact rows, 25 at a time with "Show more", an instant name search
// and two chips in a slim sticky block, and the rest in the "Filter and order" sheet. Everything runs in
// the browser over the rows the page sent; filters and the order are kept in the address (a reload or a
// shared link shows the same list), and only the order is remembered on this browser. In the default
// order, Check in and Needs help come first under their own heading. A row opens the member's sheet.
import { useState } from "react";

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
import type { EditorContext } from "./MemberCards";
import { MemberListRow, toAskText, type Column } from "./MemberListRow";
import { useMembersList, type ListState } from "./members-list-state";
import { MembersFilters } from "./MembersFilters";
import { MemberSheet } from "./MemberSheet";
import { CountLine, Empty, More, StickyBar } from "./MembersListParts";
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
  editor: EditorContext;
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

/** One row with its second lines: the past name the search found, what to ask, their time. */
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
  return (r: ListRow, index: number) => {
    const was = pastMatch(r, s.query.q);
    return (
      <MemberListRow
        key={r.uid}
        row={r}
        column={COLUMN[s.order]}
        words={t}
        was={was && fill(t["list.was"], { name: isolate(was) })}
        toAsk={s.query.ask ? toAskText(r, t) : null}
        theirTime={theirTime(r)}
        index={index}
        onOpen={() => onOpen(r.uid)}
      />
    );
  };
}

/** The heading (Check in and Needs help) and the groups, within "Show more"'s depth. */
function Sections({ s, t, row }: { s: ListState; t: ListWords; row: ReturnType<typeof useRows> }) {
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
          <h2 id="ml-heading" className="font-subhead text-display-sm">
            {t["list.heading"]}
          </h2>
          <ul className="mt-1">{heading}</ul>
        </section>
      )}
      {s.groups.map((g) => {
        const shown = take(g.rows);
        if (shown.length === 0) return null;
        const head = label(g.key, g.rows.length);
        return (
          <section key={g.key} aria-label={head ?? undefined} className="mt-2">
            {head && <h2 className="mt-3 text-body-sm font-semibold text-ink/80">{head}</h2>}
            <ul>{shown}</ul>
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

export function MembersList(props: MembersListProps) {
  const { rows, words: t } = props;
  // The sheet frame gives each sheet its history entry: the phone's back button closes it.
  const [filters, setFilters] = useState(false);
  const [member, setMember] = useState<number | null>(null);
  const s = useMembersList({ ...props, sheetOpen: filters });
  const row = useRows(s, props, setMember);
  const all = s.heading.length + s.groups.reduce((n, g) => n + g.rows.length, 0);
  const open = rows.find((r) => r.uid === member);
  return (
    <>
      <StickyBar s={s} t={t} column={COLUMN[s.order]} onFilters={() => setFilters(true)} />
      <CountLine
        s={s}
        t={t}
        total={rows.length}
        pills={pillsOf(s, t, props.language)}
        copy={copyText(s, props.sheetHeader)}
      />
      <Empty s={s} t={t} rows={rows} />
      <Sections s={s} t={t} row={row} />
      <More s={s} t={t} left={all - s.depth} />
      {filters && s.sheet && <Filters s={s} props={props} onClose={() => setFilters(false)} />}
      {open && (
        <MemberSheet
          row={open}
          version={rows}
          words={t}
          editor={props.editor}
          onClose={() => setMember(null)}
        />
      )}
    </>
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
