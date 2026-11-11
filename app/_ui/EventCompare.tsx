// Event vs event (D57, issue 177): the player page's `history-row` turned on alliances. One card per alliance
// (per member in one alliance's view), a line per event: the event's date and ledger rank on the left,
// then each figure's change during that event (Before → After). Details holds the reference values from
// the first event to the second. Below 640 px a card; from 640 px a table row whose name spans both lines.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { changeDifference } from "@/lib/compute";
import { fill, type Dictionary } from "@/lib/copy";
import type { AllianceComparison, AllianceEventFigures, EventComparison } from "@/lib/queries";

import { compareHref } from "./ComparePicker";
import { DetailTable } from "./DetailLines";
import { joinedText, leftText, allianceLabel, type Clock } from "./format";
import { Delta, Num, Rank } from "./Num";
import { AllianceBadge } from "./Pictures";
import { LABEL, MoreBar } from "./StatTable";
import { FreshDots, type FreshState } from "./Status";

export const MUTED = "text-ink/70";
export const NAME =
  "min-w-0 break-words font-subhead text-display-sm leading-tight text-plum after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline";
type Event = EventComparison["a"];

/** ≥ 640 px: name · line head · one column per figure, shared by the header and every row. */
const gridOf = (figures: number) =>
  ({
    "--cols": `minmax(0,1.6fr) minmax(0,0.7fr) repeat(${figures},minmax(0,1fr))`,
  }) as CSSProperties;

/** The line's head: the event's date, with the time when both events fall on one day. */
export function eventHead(e: Event, other: Event, clock: Clock) {
  const day = clock.day(e.eventAtUtc);
  return day === clock.day(other.eventAtUtc) ? `${day} ${clock.hhmm(e.eventAtUtc)}` : day;
}

export function CompareHeader({ lead, columns }: { lead: string; columns: string[] }) {
  return (
    <div
      style={gridOf(columns.length)}
      className={`hidden border-b border-rule px-3 pb-1 sm:grid sm:grid-cols-[var(--cols)] sm:gap-x-3 ${LABEL}`}
    >
      <span className="col-span-2">{lead}</span>
      {columns.map((c) => (
        <span key={c} className="text-right">
          {c}
        </span>
      ))}
    </div>
  );
}

interface Line {
  key: string;
  head: ReactNode;
  cells: ReactNode[];
  /** The difference line (UX review N8): set off by a hairline; `label` heads it on a row of its own
   * below 640 px, where the head column has no room for two dates. */
  label?: string;
  /** Below 640 px a row of its own above the line (the player's alliance, issue 199); the head column
   * has no room for it there. From 640 px the caller puts it in `head`. */
  above?: ReactNode;
}

/** One card / row: the name, column heads inside the card below 640 px, then one line per event.
 * From 640 px the name cell spans every line (issue 233), so each line starts in the head column. */
export function CompareCard({
  name,
  columns,
  lines,
  more,
}: {
  name: ReactNode;
  columns: string[];
  lines: Line[];
  more?: ReactNode;
}) {
  return (
    <li
      style={gridOf(columns.length)}
      className={`stat-card relative mb-3 grid items-baseline gap-x-3 gap-y-1 border border-rule p-3 sm:mb-0 sm:grid-cols-[var(--cols)] sm:border-0 sm:border-b sm:py-2 ${columns.length === 3 ? "grid-cols-[auto_repeat(3,minmax(0,1fr))]" : "grid-cols-[auto_repeat(2,minmax(0,1fr))]"}`}
    >
      <div
        className={`col-span-full mb-1 flex items-center gap-2 border-b border-rule pb-2 sm:col-span-1 sm:mb-0 sm:border-0 sm:pb-0 ${lines.length === 3 ? "sm:row-span-3" : "sm:row-span-2"}`}
      >
        {name}
      </div>
      <span className="sm:hidden" />
      {columns.map((h) => (
        <span key={h} className={`${LABEL} text-right sm:hidden`}>
          {h}
        </span>
      ))}
      {lines.map((l) => {
        const rule = l.label ? "border-t border-rule pt-1" : "";
        return (
          <div key={l.key} className="contents">
            {l.above && (
              <span className="col-span-full mt-1 flex min-w-0 items-center gap-2 text-sm sm:hidden">
                {l.above}
              </span>
            )}
            {l.label && (
              <span className={`col-span-full mt-1 text-xs sm:hidden ${MUTED} ${rule}`}>
                {l.label}
              </span>
            )}
            <span
              className={`text-xs tabular-nums ${MUTED} ${l.label ? "sm:border-t sm:border-rule sm:pt-1" : ""}`}
            >
              {l.head}
            </span>
            {l.cells.map((c, i) => (
              <span
                key={i}
                className={`text-right text-sm tabular-nums ${l.label ? "sm:border-t sm:border-rule sm:pt-1" : ""}`}
              >
                {c}
              </span>
            ))}
          </div>
        );
      })}
      {more}
    </li>
  );
}

export const dash = (key: string) => (
  <span key={key} className={MUTED}>
    —
  </span>
);

/** Might, Kills, Members changed during one event; the `*` when Might or Kills fell while members left. */
function allianceCells(f: AllianceEventFigures | null): ReactNode[] {
  if (!f) return [dash("m"), dash("k"), dash("n")];
  const fell = (d: number | undefined) => d !== undefined && d < 0 && (f.members.left ?? 0) > 0;
  return [
    <Delta
      key="m"
      delta={f.change?.power ?? null}
      base={f.opening.power}
      stack
      memberMark={fell(f.change?.power)}
    />,
    <Delta
      key="k"
      delta={f.change?.kills ?? null}
      base={f.opening.kills}
      stack
      memberMark={fell(f.change?.kills)}
    />,
    <Delta key="n" delta={f.members.change} base={null} />,
  ];
}

/** The difference line's cells: the second event's change minus the first's, `—` when either is missing. */
export function differenceCells(pairs: [number | null | undefined, number | null | undefined][]) {
  return pairs.map(([first, second], i) => {
    const d = changeDifference(first, second);
    return d ? <Delta key={i} delta={d.delta} base={d.base} stack /> : dash(String(i));
  });
}

/** The difference line's words: `Oct 31 vs Oct 24`, the second event first. */
export const versus = (data: Pick<EventComparison, "a" | "b">, clock: Clock, copy: Dictionary) =>
  fill(copy.compare.versus, {
    a: eventHead(data.b, data.a, clock),
    b: eventHead(data.a, data.b, clock),
  });

/** The worst side of either event, as the row's one mark (only when something is wrong). */
function worstMark(r: AllianceComparison, copy: Dictionary) {
  const sides = [r.a?.before, r.a?.after, r.b?.before, r.b?.after].flatMap((s) =>
    s ? [{ ...s, updatedAt: null } satisfies FreshState] : [],
  );
  const worst = sides.find((s) => s.failed) ?? sides.find((s) => !s.isFresh) ?? null;
  return <FreshDots before={worst} after={null} copy={copy} />;
}

/** Details: each figure's reference value in the first event → in the second, and who joined or left. */
function betweenDetail(
  r: AllianceComparison,
  data: EventComparison,
  clock: Clock,
  copy: Dictionary,
) {
  const l = copy.ledger;
  const ref = (f: AllianceEventFigures | null, k: "power" | "kills" | "members") =>
    f?.reference?.[k] ?? null;
  const change = (k: "power" | "kills" | "members") => {
    const [x, y] = [ref(r.a, k), ref(r.b, k)];
    return r.between && x !== null && y !== null ? y - x : null;
  };
  const row = (label: string, k: "power" | "kills" | "members", note?: string) => ({
    label,
    from: <Num n={ref(r.a, k)} />,
    to: <Num n={ref(r.b, k)} />,
    change: <Delta delta={change(k)} base={k === "members" ? null : ref(r.a, k)} />,
    note,
  });
  const moved =
    r.between && `${joinedText(r.between.joined, copy)} · ${leftText(r.between.left, copy)}`;
  return (
    <>
      <p className={`mb-1 text-xs ${MUTED}`}>{copy.compare.between}</p>
      <DetailTable
        from={eventHead(data.a, data.b, clock)}
        to={eventHead(data.b, data.a, clock)}
        rows={[
          row(l.might, "power"),
          row(l.kills, "kills"),
          row(l.members, "members", moved || undefined),
        ]}
      />
    </>
  );
}

const rankHead = (head: string, f: AllianceEventFigures | null) => (
  <span className="flex flex-col">
    <span className="font-medium text-ink">{head}</span>
    <Rank n={f?.rank.n ?? null} move={f?.rank.move ?? null} />
  </span>
);

export function AllianceCompareCard({
  r,
  data,
  linked,
  clock,
  copy,
}: {
  r: AllianceComparison;
  data: EventComparison;
  /** The list links each alliance to its members view; that view itself does not. */
  linked: boolean;
  clock: Clock;
  copy: Dictionary;
}) {
  const label = allianceLabel(r.tag, r.name);
  const l = copy.ledger;
  return (
    <CompareCard
      name={
        <>
          <AllianceBadge badgeId={r.badgeId} />
          {linked ? (
            <Link href={compareHref(data.a.id, data.b.id, r.unionId)} className={NAME}>
              {label}
            </Link>
          ) : (
            <span className="min-w-0 break-words font-subhead text-display-sm leading-tight">
              {label}
            </span>
          )}
        </>
      }
      columns={[l.might, l.kills, l.members]}
      lines={[
        ...(["a", "b"] as const).map((k) => ({
          key: k,
          head: rankHead(eventHead(data[k], data[k === "a" ? "b" : "a"], clock), r[k]),
          cells: allianceCells(r[k]),
        })),
        {
          key: "diff",
          label: versus(data, clock, copy),
          head: <span className="hidden sm:inline">{versus(data, clock, copy)}</span>,
          cells: differenceCells([
            [r.a?.change?.power, r.b?.change?.power],
            [r.a?.change?.kills, r.b?.change?.kills],
            [r.a?.members.change, r.b?.members.change],
          ]),
        },
      ]}
      more={
        <MoreBar
          row={{
            key: String(r.unionId),
            lead: null,
            metrics: [],
            summary: worstMark(r, copy),
            detail: betweenDetail(r, data, clock, copy),
          }}
          copy={copy}
        />
      }
    />
  );
}
