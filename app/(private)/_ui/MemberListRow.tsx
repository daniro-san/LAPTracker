"use client";

// One member in the Members list (issue 337): the photo in its frame as the public pages draw it (D65),
// rank and name, the order's number and the week's donations. A second line only when there is something
// to say: the status with its evidence, what is still to ask, and the member's own time. The whole row is
// one button that opens the member's sheet; nothing is hover-only.
import { PlayerAvatar } from "@/app/_ui/Pictures";
import { fill } from "@/lib/copy";

import type { ListRow, ListWords } from "./member-list-data";
import { STATUS_TONE } from "./MemberCards";

/** Which number the row shows first: the order's own, else might. */
export type Column = "might" | "kills" | "squad";

/** "48.2M · T10" needs more room than "58.5M"; the sticky labels use the same widths. */
export const COLUMN_WIDTH: Record<Column, string> = {
  might: "w-[4.5rem]",
  kills: "w-[4.5rem]",
  squad: "w-24",
};

export function MemberListRow(props: {
  row: ListRow;
  column: Column;
  words: ListWords;
  /** "To ask: main squad, time zone", when the Info to ask chip is on. */
  toAsk: string | null;
  /** "was Mara", when the search found a past name. */
  was: string | null;
  /** "14:05 their time", once the browser knows the time; null without a time zone. */
  theirTime: string | null;
  index: number;
  onOpen: () => void;
}) {
  const { row, words: t } = props;
  const extra = [props.was, props.toAsk, props.theirTime].filter((x) => x !== null);
  return (
    <li>
      <button
        type="button"
        data-row={props.index}
        aria-haspopup="dialog"
        onClick={props.onOpen}
        className="tint-button flex min-h-14 w-full items-center gap-2 border-t border-rule px-1 py-1.5 text-left"
      >
        {/* One width with or without a game frame, so the names line up. */}
        <span className="flex w-[51px] shrink-0 justify-center">
          <PlayerAvatar uid={row.uid} photo={row.photo} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-baseline gap-2">
            <span translate="no" className="shrink-0 text-body-sm text-ink/70">
              {row.rankShort}
            </span>
            <span translate="no" className="min-w-0 flex-1 truncate font-semibold">
              {row.name}
            </span>
            <span
              className={`${COLUMN_WIDTH[props.column]} shrink-0 text-right text-body-sm font-medium tabular-nums`}
            >
              <span className="sr-only">{`${t[`list.col.${props.column}`]} `}</span>
              {row.text[props.column]}
            </span>
            <span className="w-12 shrink-0 text-right text-body-sm text-ink/80 tabular-nums">
              <span className="sr-only">{`${t["list.col.donated"]} `}</span>
              {row.text.donated}
            </span>
          </span>
          {/* The status and its evidence on one line, under the numbers too; the full text is in
              the sheet. What a filter or the search shows has its own line, never cut. */}
          {row.statusLine && (
            <span className={`truncate text-body-sm ${STATUS_TONE[row.status]}`}>
              {row.statusLine}
            </span>
          )}
          {extra.length > 0 && (
            <span className="text-body-sm text-ink/75">{extra.join(" · ")}</span>
          )}
        </span>
      </button>
    </li>
  );
}

/** "To ask: main squad, time zone" from the facts not recorded. */
export const toAskText = (row: ListRow, t: ListWords) =>
  row.ask.length === 0
    ? null
    : fill(t["list.toAsk"], { list: row.ask.map((f) => t[`list.ask.${f}`]).join(", ") });
