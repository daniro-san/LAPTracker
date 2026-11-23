// One event's server pulse as a strip of boxes on the server clock (issue 284, D86): a column per
// 15-minute slot, shared by every strip on the page so noon is noon in each; a bar as high as the slot's
// share of the event's kills; a hollow stub where the game sent no update; a hairline where nothing could
// be read; the busiest 30 minutes outlined; the hours in HTML under it; every figure in `PulseDetails`,
// which the pages show while the `chart-details` flag is on (D91).
// A chart under D68 (hand-built, no library, HTML boxes by its amendment of PR 319, labels in HTML, numbers
// beside it). Nothing is hover-only and nothing scrolls sideways: the columns share the width.
import type { CSSProperties } from "react";

import type { Dictionary } from "@/lib/copy";
import type { EventClock } from "@/lib/fight-clock";
import { fill } from "@/lib/words";

import { Bar } from "./charts/Bar";
import type { ReadoutItem } from "./charts/Readout";
import { compact, shareText, type Clock } from "./format";
import { MoreBar, LABEL } from "./StatTable";

export const FIGHT_CLOCK_PATH = "/events/fight-clock";

export interface Column {
  minute: number;
  at: Date;
}

const grid = (n: number): CSSProperties => ({
  gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
});

/** The tallest share among the strips drawn together, so their bars can be read against each other. */
export const mostShare = (clocks: readonly EventClock[]) =>
  Math.max(0.01, ...clocks.flatMap((c) => c.slots.map((s) => s.share ?? 0)));

/** The event's busiest 30 minutes in a sentence, or that there are too few readings to name them. */
export function busiestText(
  clock: EventClock,
  everyMin: number,
  zone: Clock,
  copy: Dictionary,
  locale: string,
): string {
  const [b, span] = [clock.busiest, 2 * everyMin];
  return b
    ? fill(copy.ledger.liveBusiestDone, {
        span,
        from: zone.hhmm(b.from),
        to: zone.time(b.to),
        share: shareText(b.share, locale),
      })
    : fill(copy.ledger.fightClockNoBusiest, { span });
}

/** A column's box: the outline of the busiest span is drawn on its sides, so the pair reads as one box. */
function outline(i: number, busiest: EventClock["busiest"]) {
  if (!busiest || (i !== busiest.index && i !== busiest.index + 1)) return "border-transparent";
  return `border-plum ${i === busiest.index ? "border-r-0" : "border-l-0"}`;
}

export function PulseStrip({
  columns,
  clock,
  most,
  everyMin,
  zone,
  copy,
  locale,
}: {
  columns: Column[];
  clock: EventClock;
  /** `mostShare` of the strips on the page. */
  most: number;
  everyMin: number;
  zone: Clock;
  copy: Dictionary;
  locale: string;
}) {
  const slotOf = new Map(clock.slots.map((s, i) => [s.minute, { s, i }]));
  return (
    <div>
      <ul className="grid h-14 gap-0.5" style={grid(columns.length)}>
        {columns.map((c, at) => {
          const hit = slotOf.get(c.minute);
          if (!hit) return <li key={c.minute} data-at={at} aria-hidden="true" />;
          const { s, i } = hit;
          const span = `${zone.hhmm(s.at)}–${zone.hhmm(new Date(s.at.getTime() + everyMin * 60_000))}`;
          const inBusiest = outline(i, clock.busiest) !== "border-transparent";
          return (
            <li
              key={c.minute}
              // The column's place on the shared clock: a tap picks it in the readout under the strips.
              data-at={at}
              className={`flex min-w-0 cursor-pointer flex-col justify-end border-2 px-px pb-px aria-[current=true]:bg-plum/10 ${outline(i, clock.busiest)}`}
            >
              {s.state === "moved" ? (
                <Bar
                  axis="column"
                  share={(s.share ?? 0) / most}
                  tone={`rounded-t-sm ${inBusiest ? "bg-plum" : "bg-plum/60"}`}
                  className="h-full w-full"
                />
              ) : s.state === "still" ? (
                <div className="h-2 w-full rounded-sm border border-dashed border-ink/60" />
              ) : (
                <div className="h-px w-full bg-ink/50" />
              )}
              <span className="sr-only">
                {span}:{" "}
                {s.state === "moved"
                  ? shareText(s.share ?? 0, locale)
                  : s.state === "still"
                    ? copy.ledger.liveNoUpdate
                    : copy.ledger.liveNoReading}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 grid text-xs tabular-nums text-ink/70" style={grid(columns.length)}>
        {columns.map((c, i) =>
          c.minute % 60 === 0 ? (
            <span
              key={c.minute}
              style={{ gridColumn: i + 1 }}
              // The last hours sit at the strip's end: their label grows to the left, never past the page.
              className={`whitespace-nowrap ${i >= columns.length - 2 ? "justify-self-end" : ""}`}
            >
              {zone.hhmm(c.at)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/**
 * One readout for every strip drawn together (D158 rule 7 (a)): for each column of the shared clock, its
 * interval and each event's share of its kills there ("A 12% (3.1K kills) · B No update"). It starts on the
 * first event's busiest slot, else the last column.
 */
export function stripsReadout(
  columns: Column[],
  events: { short: string; clock: EventClock }[],
  everyMin: number,
  zone: Clock,
  copy: Dictionary,
  locale: string,
): { items: ReadoutItem[]; initial: number } {
  const items = columns.map((c) => ({
    label: `${zone.hhmm(c.at)}–${zone.hhmm(new Date(c.at.getTime() + everyMin * 60_000))}`,
    line: events
      .map((e) => {
        const s = e.clock.slots.find((x) => x.minute === c.minute);
        const figure = !s
          ? "—"
          : s.state === "moved"
            ? fill(copy.ledger.readoutShare, {
                share: shareText(s.share ?? 0, locale),
                kills: compact(s.kills ?? 0, locale),
              })
            : s.state === "still"
              ? copy.ledger.liveNoUpdate
              : copy.ledger.liveNoReading;
        return `${e.short} ${figure}`;
      })
      .join(" · "),
  }));
  const first = events[0]?.clock;
  const busiest = first?.busiest ? first.slots[first.busiest.index]?.minute : undefined;
  const at = columns.findIndex((c) => c.minute === busiest);
  return { items, initial: at >= 0 ? at : columns.length - 1 };
}

/** The figures of one or more strips, one row per slot, under Details: the share (and the kills gained)
 * of each event, or the words for a slot with no figure. */
export function PulseDetails({
  columns,
  events,
  clock,
  everyMin,
  copy,
  locale,
  lead,
}: {
  columns: Column[];
  events: { key: string; label: string; clock: EventClock }[];
  clock: Clock;
  everyMin: number;
  copy: Dictionary;
  locale: string;
  /** The name Details is announced with. */
  lead: string;
}) {
  const cell = "py-1 pl-2 text-right align-top";
  return (
    <MoreBar
      row={{
        key: "pulse-details",
        lead,
        metrics: [],
        detail: (
          <table className="w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className={`py-1 text-left font-normal ${LABEL}`}>
                  {copy.ledger.liveInterval} · {clock.zone}
                </th>
                {events.map((e) => (
                  <th key={e.key} scope="col" className={`${cell} ${LABEL}`}>
                    {e.label} · {copy.ledger.fightClockShare}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.minute} className="border-b border-rule last:border-0">
                  <th scope="row" className="py-1 text-left font-normal">
                    {clock.hhmm(c.at)}–{clock.hhmm(new Date(c.at.getTime() + everyMin * 60_000))}
                  </th>
                  {events.map((e) => {
                    const s = e.clock.slots.find((x) => x.minute === c.minute);
                    return (
                      <td key={e.key} className={cell}>
                        {!s ? (
                          <span className="text-ink/70">—</span>
                        ) : s.state === "moved" ? (
                          <>
                            <span className="font-medium">{shareText(s.share ?? 0, locale)}</span>
                            <span className="block text-ink/70">
                              {compact(s.kills ?? 0, locale)} {copy.ledger.kills}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink/70">
                            {s.state === "still"
                              ? copy.ledger.liveNoUpdate
                              : copy.ledger.liveNoReading}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ),
      }}
      copy={copy}
    />
  );
}
