// A table that grows with the width (DESIGN.md "Layout system", D122): cards below 640 from the caller's
// card renderer; a table from 640 whose columns appear by priority (640, 1024, 1440); the head row sticky
// (under the caller's own sticky bar: `--table-head-top`, 0 by default); numbers right-aligned and
// tabular; rows 44 px or taller. The open row (master-detail) is tinted plum with a 3 px bar and carries
// aria-current. With `onRow` a press anywhere on a row opens it; the row's own control (a button in a
// cell, which the keyboard reaches) does the same by its click bubbling to the row. `compact` cards are
// rows of a list divided by hairlines (people), not spaced cards.
import type { ReactNode } from "react";

import { cellClass, type ColumnPriority } from "./layout-rules";

export interface Column<Row> {
  key: string;
  head: ReactNode;
  cell: (row: Row) => ReactNode;
  priority?: ColumnPriority;
  numeric?: boolean;
  /** A width class for the head cell ("w-20"), so tables shown one under another line up. */
  width?: string;
}

export function ResponsiveTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  card,
  isOpen,
  onRow,
  compact = false,
}: {
  /** The table's name for screen readers. */
  caption: string;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** One row as a card, below 640. */
  card: (row: Row) => ReactNode;
  isOpen?: (row: Row) => boolean;
  onRow?: (row: Row) => void;
  compact?: boolean;
}) {
  const align = (c: Column<Row>) => (c.numeric ? "text-right tabular-nums" : "text-left");
  return (
    <>
      <ul className={`flex flex-col ${compact ? "" : "gap-3"} sm:hidden`} aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} aria-current={isOpen?.(row) ? "true" : undefined}>
            {card(row)}
          </li>
        ))}
      </ul>
      <table className="hidden w-full border-collapse sm:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`${cellClass(c.priority ?? "always")} ${align(c)} ${c.width ?? ""} sticky top-[var(--table-head-top,0px)] z-[4] border-b whitespace-nowrap border-ink bg-paper px-2 py-2 text-label font-semibold tracking-[0.04em] text-ink/75 uppercase`}
              >
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = isOpen?.(row) ?? false;
            return (
              <tr
                key={rowKey(row)}
                aria-current={open ? "true" : undefined}
                onClick={onRow && (() => onRow(row))}
                className={`${onRow ? "cursor-pointer" : ""} ${
                  open
                    ? "bg-plum/15 [&>td:first-child]:shadow-[inset_3px_0_0_var(--plum)]"
                    : onRow
                      ? "hover:bg-plum/5"
                      : ""
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`${cellClass(c.priority ?? "always")} ${align(c)} h-11 border-b border-rule px-2 py-1.5`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
