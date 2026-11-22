"use client";

// One member in the Members list (issue 337): the photo in its frame as the public pages draw it (D65),
// rank and name, the order's number and the week's donations. A second line only when there is something
// to say: the status with its evidence, what is still to ask, and the member's own time. The whole row is
// one button that opens the member's sheet; nothing is hover-only. Below 640 it is the list's card; from
// 640 `MemberCell` is the name cell of the table (D122), whose row opens the member.
import { PlayerAvatar } from "@/app/_ui/Pictures";
import { fill } from "@/lib/words";

import type { ListRow, ListWords } from "./member-list-data";
import { STATUS_TONE } from "./MemberCards";
import { withNoData } from "./NoData";

/** Which number the row shows first: the order's own, else might. */
export type Column = "might" | "kills" | "squad";

/** "48.2M · T10" needs more room than "58.5M"; the sticky labels use the same widths. */
export const COLUMN_WIDTH: Record<Column, string> = {
  might: "w-[4.5rem]",
  kills: "w-[4.5rem]",
  squad: "w-24",
};

export interface RowProps {
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
  /** Opens a sheet (below 1024) rather than the pane. */
  sheet: boolean;
  onOpen: () => void;
}

/** The button's own attributes: the list's index (Show more, the arrow keys) and the member. */
const rowButton = (props: RowProps) => ({
  type: "button" as const,
  "data-row": props.index,
  "data-uid": props.row.uid,
  "aria-haspopup": props.sheet ? ("dialog" as const) : undefined,
});

/** One width with or without a game frame, so the names line up. */
const Photo = ({ row }: { row: ListRow }) => (
  <span className="flex w-[51px] shrink-0 justify-center self-start">
    <PlayerAvatar uid={row.uid} photo={row.photo} />
  </span>
);

/** The status and its evidence, under the numbers too, and what a filter or the search shows: each wraps and is
 * never cut (issue 585: a cut reason hid the part an officer needs). */
function Lines(props: RowProps) {
  const { row } = props;
  const extra = [props.was, props.toAsk, props.theirTime].filter((x) => x !== null);
  return (
    <>
      {row.statusLine && (
        // ph-no-capture (issue 549): "No daily quests on {day}" and the other reasons never reach replay.
        <span className={`ph-no-capture text-pretty text-body-sm ${STATUS_TONE[row.status]}`}>
          {row.statusLine}
        </span>
      )}
      {extra.length > 0 && <span className="text-body-sm text-ink/75">{extra.join(" · ")}</span>}
    </>
  );
}

export function MemberListRow(props: RowProps) {
  const { row, words: t } = props;
  return (
    <button
      {...rowButton(props)}
      onClick={props.onOpen}
      className="tint-button flex min-h-14 w-full items-center gap-2 border-t border-rule px-1 py-1.5 text-left"
    >
      <Photo row={row} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-2">
          <span translate="no" className="shrink-0 text-body-sm text-ink/70">
            {row.rankShort}
          </span>
          <span translate="no" className="min-w-0 flex-1 font-semibold break-words">
            {row.name}
          </span>
          <span
            className={`${COLUMN_WIDTH[props.column]} shrink-0 text-right text-body-sm font-medium tabular-nums`}
          >
            <span className="sr-only">{`${t[`list.col.${props.column}`]} `}</span>
            {withNoData(row.text[props.column], t["nodata.mark"])}
          </span>
          {/* ph-no-capture (issue 549): the week's donations never reach session replay. */}
          <span className="ph-no-capture w-12 shrink-0 text-right text-body-sm text-ink/80 tabular-nums">
            <span className="sr-only">{`${t["list.col.donated"]} `}</span>
            {withNoData(row.text.donated, t["nodata.mark"])}
          </span>
        </span>
        <Lines {...props} />
      </span>
    </button>
  );
}

/** The table's name cell from 640: its press reaches the row, which opens the member. The name wraps. */
export function MemberCell(props: RowProps) {
  const { row } = props;
  return (
    <button {...rowButton(props)} className="flex w-full items-center gap-2 py-0.5 text-left">
      <Photo row={row} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-2">
          <span translate="no" className="shrink-0 text-body-sm text-ink/70">
            {row.rankShort}
          </span>
          <span translate="no" className="min-w-0 font-semibold">
            {row.name}
          </span>
        </span>
        <Lines {...props} />
      </span>
    </button>
  );
}

/** "To ask: main squad, time zone" from the facts not recorded. */
export const toAskText = (row: ListRow, t: ListWords) =>
  row.ask.length === 0
    ? null
    : fill(t["list.toAsk"], { list: row.ask.map((f) => t[`list.ask.${f}`]).join(", ") });
