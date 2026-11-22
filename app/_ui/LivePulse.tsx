// The server pulse (issue 307): kills gained per reading interval as HTML/CSS bars, the busiest two intervals
// underlined and named in text, the numbers in a Details table. The game moves an alliance's numbers every
// 10-13 minutes, so an interval can hold no update: it shows as a hollow stub, never as a quiet zero.
// A chart under D68 (docs/decisions/D68-charts-are-hand-built-inline-svg.md): hand-built, no chart library,
// labels in HTML, numbers beside it (the busiest-span sentence, and the Details table while the
// `chart-details` flag is on, D91). Its bars are HTML boxes, which D68 allows by its amendment of
// 2026-11-16 (PR 319); a line chart stays SVG.
import { TextLink } from "@/lib/brand/components/TextLink";
import { type Dictionary } from "@/lib/copy";
import type { EventProgress } from "@/lib/queries";
import { fill } from "@/lib/words";

import { compact, shareText, type Clock } from "./format";
import { Num } from "./Num";
import { FIGHT_CLOCK_PATH } from "./PulseStrip";
import { LABEL, MoreBar } from "./StatTable";

type Progress = EventProgress;

const barHeight = (kills: number, most: number) =>
  `${Math.max(6, Math.round((kills / most) * 100))}%`;

/** One bar per interval: a filled bar for a gain, a hollow stub when the game sent no update, a hairline
 * when nothing could be compared; the busiest two intervals are underlined. */
function Bars({ progress, clock, copy }: { progress: Progress; clock: Clock; copy: Dictionary }) {
  const { pulse, busiest } = progress;
  const most = Math.max(1, ...pulse.map((s) => s.kills ?? 0));
  const span = (from: Date, to: Date) => `${clock.hhmm(from)}–${clock.hhmm(to)}`;
  return (
    <ul className="mt-3 flex h-28 items-end gap-0.5">
      {pulse.map((s, i) => {
        const inBusiest = busiest !== null && (i === busiest.index || i === busiest.index + 1);
        return (
          <li
            key={s.from.getTime()}
            className={`flex h-full min-w-0 flex-1 flex-col justify-end border-b-2 pb-0.5 ${inBusiest ? "border-plum" : "border-transparent"}`}
          >
            {s.kills !== null && s.state === "moved" ? (
              <div
                className={`w-full rounded-t-sm ${inBusiest ? "bg-plum" : "bg-plum/60"}`}
                style={{ height: barHeight(Math.max(0, s.kills), most) }}
              />
            ) : s.state === "still" ? (
              <div className="h-2 w-full rounded-sm border border-dashed border-ink/60" />
            ) : (
              <div className="h-px w-full bg-ink/50" />
            )}
            <span className="sr-only">
              {span(s.from, s.to)}:{" "}
              {s.state === "moved" && s.kills !== null
                ? `${s.kills} ${copy.ledger.kills}`
                : s.state === "still"
                  ? copy.ledger.liveNoUpdate
                  : copy.ledger.liveNoReading}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The key to the stub and the hairline; also under the strips across events (D86). */
export function PulseLegend({
  pulse,
  copy,
}: {
  pulse: readonly { state: string }[];
  copy: Dictionary;
}) {
  const hasStill = pulse.some((s) => s.state === "still");
  const hasMissing = pulse.some((s) => s.state === "missing");
  return (
    (hasStill || hasMissing) && (
      <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-ink/70">
        {hasStill && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-4 rounded-sm border border-dashed border-ink/60"
            />
            {copy.ledger.liveNoUpdate}
          </span>
        )}
        {hasMissing && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-px w-4 bg-ink/50" />
            {copy.ledger.liveNoReading}
          </span>
        )}
      </p>
    )
  );
}

/** Kills gained per interval as bars, the busiest two intervals underlined and named, the numbers under
 * Details while `details` (the `chart-details` flag, D91) is on. */
export function Pulse({
  progress,
  details,
  clock,
  copy,
  locale,
}: {
  progress: Progress;
  details: boolean;
  clock: Clock;
  copy: Dictionary;
  locale: string;
}) {
  const { pulse, busiest } = progress;
  if (pulse.length === 0) return null;
  const alliances = Math.max(...pulse.map((s) => s.alliances));
  const first = pulse[0];
  const last = pulse[pulse.length - 1];
  if (!first || !last) return null;
  return (
    <section aria-labelledby="live-pulse" className="mb-6">
      <h3 id="live-pulse" className="font-subhead text-display-sm leading-tight">
        {copy.ledger.livePulse}
      </h3>
      <p className="text-body-sm text-ink/70">
        {fill(copy.ledger.livePulseHelp, { n: alliances, min: progress.everyMin })}
      </p>
      {busiest ? (
        <p className="mt-2 font-medium tabular-nums">
          {fill(progress.live ? copy.ledger.liveBusiest : copy.ledger.liveBusiestDone, {
            span: 2 * progress.everyMin,
            from: clock.hhmm(busiest.from),
            to: clock.time(busiest.to),
            share: shareText(busiest.share, locale),
          })}
        </p>
      ) : (
        // Too few intervals to name a busiest span: the total is the honest figure.
        progress.live && (
          <p className="mt-2 font-medium tabular-nums">
            {fill(copy.ledger.liveKillsSoFar, { kills: compact(progress.killsTotal, locale) })}
          </p>
        )
      )}
      {busiest && progress.live && last.kills !== null && (
        <p className="text-body-sm tabular-nums text-ink/70">
          {fill(copy.ledger.liveLast, {
            min: progress.everyMin,
            last: compact(last.kills, locale),
            peak: compact(Math.max(...pulse.map((s) => s.kills ?? 0)), locale),
          })}
        </p>
      )}
      <Bars progress={progress} clock={clock} copy={copy} />
      <div className="mt-1 flex justify-between gap-2 text-body-sm tabular-nums text-ink/70">
        <span>{clock.hhmm(first.from)}</span>
        <span>{clock.time(last.to)}</span>
      </div>
      <PulseLegend pulse={pulse} copy={copy} />
      <p className="mt-1">
        <TextLink href={FIGHT_CLOCK_PATH} className="inline-flex min-h-11 items-center">
          {copy.ledger.fightClockLink}
        </TextLink>
      </p>
      {details && (
        <div className="mt-2">
          <MoreBar
            row={{
              key: "pulse",
              lead: copy.ledger.livePulse,
              metrics: [],
              detail: <PulseTable pulse={pulse} clock={clock} copy={copy} />,
            }}
            copy={copy}
          />
        </div>
      )}
    </section>
  );
}

function PulseTable({
  pulse,
  clock,
  copy,
}: {
  pulse: Progress["pulse"];
  clock: Clock;
  copy: Dictionary;
}) {
  const cell = "py-1 pl-2 text-right align-top";
  return (
    <table className="w-full border-collapse text-sm tabular-nums">
      <thead>
        <tr className="border-b border-rule">
          <th scope="col" className={`py-1 text-left font-normal ${LABEL}`}>
            {copy.ledger.liveInterval} · {clock.zone}
          </th>
          <th scope="col" className={`${cell} ${LABEL}`}>
            {copy.ledger.liveKillsGained}
          </th>
          <th scope="col" className={`${cell} ${LABEL}`}>
            {copy.ledger.alliances}
          </th>
        </tr>
      </thead>
      <tbody>
        {pulse.map((s) => (
          <tr key={s.from.getTime()} className="border-b border-rule last:border-0">
            <th scope="row" className="py-1 text-left font-normal">
              {clock.hhmm(s.from)}–{clock.hhmm(s.to)}
            </th>
            <td className={`${cell} font-medium`}>
              {s.state === "moved" ? (
                <Num n={s.kills} />
              ) : (
                <span className="font-normal text-ink/70">
                  {s.state === "still" ? copy.ledger.liveNoUpdate : copy.ledger.liveNoReading}
                </span>
              )}
            </td>
            <td className={`${cell} text-ink/70`}>{s.alliances === 0 ? "—" : s.alliances}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
