// The member flow result (D89, issue 275): one sentence first, then a source x destination matrix (rows: the
// alliance on the first day, columns: the alliance on the second, plus New and Left). Counts only, no member
// is named, and a move under FLOW_MIN members is hidden. From 640 px the matrix is a table that scrolls inside
// its own box; on a phone each row is a <details> that lists that source's destinations as text with counts.
// HTML only (D68): the tint behind a count is decoration, the number is always written. Every alliance named
// links to its page (issue 473).
import Link from "next/link";
import { Fragment } from "react";

import { TextLink } from "@/lib/brand/components/TextLink";
import { fill, type Dictionary } from "@/lib/copy";
import { FLOW_MIN, type FlowCell } from "@/lib/flow";
import type { FlowAlliance, FlowResult } from "@/lib/queries";

import { allianceLabel, dayDate, type Clock } from "./format";
import { MERGE_PATH } from "./MergePicker";

type Id = number | null;
const key = (from: Id, to: Id) => `${from}>${to}`;
const short = (a: FlowAlliance) => a.tag ?? a.name ?? String(a.unionId);
/** An alliance's own page: its member history, which every tracked alliance has. */
const pageOf = (id: number) => `/alliances/${id}/history`;
const LINK = "text-link inline-flex min-h-11 items-center";

/** An alliance's name as a link to its page; New and Left (no alliance) as plain text. */
function Named({ id, label }: { id: Id; label: string }) {
  return id === null ? (
    <>{label}</>
  ) : (
    <Link href={pageOf(id)} className={LINK}>
      {label}
    </Link>
  );
}

/** A count's tint, three steps of the biggest move shown; a stay is a neutral one. */
const TINT = ["bg-plum/10", "bg-plum/20", "bg-plum/30"] as const;
const tint = (n: number, max: number) =>
  TINT[Math.max(0, Math.min(2, Math.ceil((3 * n) / max) - 1))];

function Lead({
  flow,
  from,
  to,
  clock,
  copy,
}: {
  flow: FlowResult;
  from: string;
  to: string;
  clock: Clock;
  copy: Dictionary;
}) {
  const f = copy.flow;
  const days = { from: clock.day(dayDate(from)), to: clock.day(dayDate(to)) };
  const label = (id: Id) => {
    const a = flow.alliances.find((x) => x.unionId === id);
    return a ? allianceLabel(a.tag, a.name) : "";
  };
  const { largest } = flow;
  // The figures are those of the cells shown: a total of every move would give away the hidden ones.
  const sentence = largest
    ? fill(f.answer, {
        ...days,
        source: label(largest.from),
        dest: label(largest.to),
        n: largest.n,
      })
    : fill(f.answerNone, { ...days, min: FLOW_MIN });
  return (
    <>
      <p className="mt-1 text-lg">{sentence}</p>
      <p className="mt-2 text-body-sm text-ink">
        {fill(f.totals, {
          min: FLOW_MIN,
          moved: flow.moved,
          arrived: flow.arrived,
          left: flow.left,
        })
          .split(" · ")
          .map((part, i) => (
            <Fragment key={part}>
              {i > 0 && " · "}
              <span className="whitespace-nowrap">{part}</span>
            </Fragment>
          ))}
      </p>
      <div className="mt-3 space-y-1 border-l-2 border-ink/15 pl-3 text-body-sm text-ink/70">
        {flow.notCounted.length > 0 && (
          <p>
            {fill(f.notCounted, {
              list: flow.notCounted.map((a) => allianceLabel(a.tag, a.name)).join(", "),
            })}
          </p>
        )}
        <p>{fill(f.small, { min: FLOW_MIN })}</p>
      </div>
    </>
  );
}

/** The wide matrix: rows are sources, columns destinations, from 640 px. */
function Matrix({
  flow,
  by,
  from,
  to,
  clock,
  copy,
}: {
  flow: FlowResult;
  by: Map<string, number>;
  from: string;
  to: string;
  clock: Clock;
  copy: Dictionary;
}) {
  const f = copy.flow;
  const days = { from: clock.day(dayDate(from)), to: clock.day(dayDate(to)) };
  const moves = flow.cells.filter((c) => c.from !== c.to).map((c) => c.n);
  const max = Math.max(1, ...moves);
  const cell = "h-9 min-w-10 border border-rule px-1 text-center text-sm tabular-nums";
  // "Left" stays in view when the table scrolls sideways (600-820 px), with the column of names on the other side.
  const stickyEnd = "sticky right-0 z-10 bg-paper";
  const head = "border border-rule px-1 py-1 text-center text-xs font-semibold";
  const rows: { id: Id; label: string }[] = [
    ...flow.alliances.map((a) => ({ id: a.unionId as Id, label: short(a) })),
    { id: null, label: f.rowNew },
  ];
  const cols: { id: Id; label: string }[] = [
    ...flow.alliances.map((a) => ({ id: a.unionId as Id, label: short(a) })),
    { id: null, label: f.colLeft },
  ];
  return (
    <div className="mt-4 hidden overflow-x-auto sm:block">
      <table className="border-collapse">
        <caption className="sr-only">{fill(f.caption, days)}</caption>
        <thead>
          <tr>
            <td className="sticky left-0 z-10 bg-paper" />
            {cols.map((c) => (
              <th
                key={String(c.id)}
                scope="col"
                className={`${head} ${c.id === null ? stickyEnd : ""}`}
              >
                <Named id={c.id} label={c.label} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <th
                scope="row"
                className="sticky left-0 z-10 whitespace-nowrap border border-rule bg-paper px-2 text-left text-sm font-semibold"
              >
                <Named id={r.id} label={r.label} />
              </th>
              {cols.map((c) => {
                const n = by.get(key(r.id, c.id));
                const stayed = r.id !== null && r.id === c.id;
                return (
                  <td
                    key={String(c.id)}
                    className={`${cell} ${c.id === null ? "sticky right-0 z-10" : ""} ${n === undefined ? (c.id === null ? "bg-paper" : "") : stayed ? "bg-ink/10" : tint(n, max)}`}
                  >
                    {n}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One phone row: the source, and when opened its destinations as text with counts. No row total: with
 * the cells shown it would give the size of the hidden ones. */
function PhoneRow({
  id,
  title,
  cells,
  names,
  copy,
}: {
  /** The source alliance; null for the New row. */
  id: Id;
  title: string;
  cells: FlowCell[];
  names: Map<Id, string>;
  copy: Dictionary;
}) {
  const f = copy.flow;
  const line = (c: FlowCell) =>
    c.to === null ? (
      f.leftTitle
    ) : c.from === c.to ? (
      f.stayed
    ) : (
      <Named id={c.to} label={names.get(c.to) ?? ""} />
    );
  // The moves first, the biggest first; the stay and the leavers after them.
  const rank = (c: FlowCell) => (c.to === null ? 1 : c.from === c.to ? 2 : 0);
  const sorted = [...cells].sort((p, q) => rank(p) - rank(q) || q.n - p.n);
  const moves = cells.some((c) => c.from !== c.to);
  const summary = "flex min-h-11 cursor-pointer items-center justify-between gap-3 py-2";
  return (
    <li className="border-b border-rule">
      {!moves ? (
        <div className={summary}>
          <span className="min-w-0 name-fit font-medium">
            <Named id={id} label={title} />
          </span>
          {cells[0] && (
            <span className="shrink-0 text-sm tabular-nums">
              {fill(f.rowStayed, { n: cells[0].n })}
            </span>
          )}
        </div>
      ) : (
        <details className="group" open>
          <summary className={summary}>
            <span className="min-w-0 name-fit font-medium">{title}</span>
            <span aria-hidden="true" className="inline-block shrink-0 group-open:rotate-90">
              ›
            </span>
          </summary>
          <ul className="pb-2">
            {/* The source's own page: its name in the summary opens and closes the row. */}
            {id !== null && (
              <li className="pl-3">
                <Named id={id} label={title} />
              </li>
            )}
            {sorted.map((c) => (
              <li key={key(c.from, c.to)} className="flex justify-between gap-3 py-1 pl-3">
                <span className="min-w-0 break-words">
                  {c.to !== null && c.from !== c.to && <span aria-hidden="true">{"→ "}</span>}
                  {line(c)}
                </span>
                <span className="shrink-0 tabular-nums">{c.n}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

export function FlowView({
  flow,
  from,
  to,
  merge,
  clock,
  copy,
}: {
  flow: FlowResult;
  from: string;
  to: string;
  /** The `merge-simulator` flag (D91): off, no link to it. */
  merge: boolean;
  clock: Clock;
  copy: Dictionary;
}) {
  const f = copy.flow;
  const by = new Map(flow.cells.map((c) => [key(c.from, c.to), c.n]));
  const names = new Map<Id, string>(
    flow.alliances.map((a) => [a.unionId, allianceLabel(a.tag, a.name)]),
  );
  const days = { from: clock.day(dayDate(from)), to: clock.day(dayDate(to)) };
  // On a phone the alliances with a move shown come first, open; the rest are one line each.
  const moved = (id: Id) => flow.cells.some((c) => c.from === id && c.from !== c.to);
  const phoneOrder = [...flow.alliances].sort((p, q) => +moved(q.unionId) - +moved(p.unionId));
  return (
    <>
      <Lead flow={flow} from={from} to={to} clock={clock} copy={copy} />
      <Matrix flow={flow} by={by} from={from} to={to} clock={clock} copy={copy} />
      <ul className="mt-4 sm:hidden">
        {phoneOrder.map((a) => (
          <PhoneRow
            key={a.unionId}
            id={a.unionId}
            title={allianceLabel(a.tag, a.name)}
            cells={flow.cells.filter((c) => c.from === a.unionId)}
            names={names}
            copy={copy}
          />
        ))}
        <PhoneRow
          id={null}
          title={f.newTitle}
          cells={flow.cells.filter((c) => c.from === null)}
          names={names}
          copy={copy}
        />
      </ul>
      <p className="mt-1 hidden text-body-sm text-ink/70 sm:block">{fill(f.legend, days)}</p>
      {merge && (
        <p className="mt-3">
          <TextLink
            href={MERGE_PATH}
            className="inline-flex min-h-11 items-center text-sm font-medium"
          >
            {copy.merge.title} <span aria-hidden="true">&nbsp;→</span>
          </TextLink>
        </p>
      )}
    </>
  );
}
