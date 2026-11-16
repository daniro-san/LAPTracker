// The compare page's server pulse (D57, issue 284, D86): events A and B on their 15-minute samples, lined
// up on the server clock so noon is noon in both, the whole events as the window. Each event's busiest 30
// minutes are named in a sentence. When either event has no samples the section is a muted frame with the
// reason and nothing is drawn. The window picker (a part of the events) is the next build; the read model
// already gives each event's slots and `bothCover` the slots both cover.
import { fill, type Dictionary } from "@/lib/copy";
import { clockColumns } from "@/lib/fight-clock";
import type { EventComparison, EventPulse } from "@/lib/queries";

import { eventHead } from "./EventCompare";
import type { Clock } from "./format";
import { PulseLegend } from "./LivePulse";
import { busiestText, mostShare, PulseDetails, PulseStrip } from "./PulseStrip";
import { LABEL } from "./StatTable";

type Side = "a" | "b";
const LETTER: Record<Side, string> = { a: "A", b: "B" };

const Heading = ({ text }: { text: string }) => (
  <h2 id="compare-pulse" className="font-subhead text-display-sm">
    {text}
  </h2>
);

export function ComparePulse({
  data,
  pulses,
  everyMin,
  clock,
  copy,
  locale,
}: {
  data: EventComparison;
  pulses: Record<Side, EventPulse>;
  everyMin: number;
  clock: Clock;
  copy: Dictionary;
  locale: string;
}) {
  const l = copy.ledger;
  const [a, b] = [pulses.a.clock, pulses.b.clock];
  if (!a || !b) {
    const off = !a && !b ? l.comparePulseOffBoth : !a ? l.comparePulseOffA : l.comparePulseOffB;
    const when = eventHead(!a ? data.a : data.b, !a ? data.b : data.a, clock);
    return (
      <section aria-labelledby="compare-pulse" className="mb-4 border-y border-rule py-3">
        <Heading text={l.livePulse} />
        <p className="mt-2 rounded-sm border border-dashed border-rule px-3 py-2 text-body-sm text-ink/70">
          {fill(off, { min: everyMin, when })}
        </p>
      </section>
    );
  }
  const span = 2 * everyMin;
  const own = { a, b };
  const all = [own.a, own.b];
  const columns = clockColumns(all);
  const most = mostShare(all);
  const sides: Side[] = ["a", "b"];
  const label = (k: Side) =>
    `${LETTER[k]} · ${eventHead(data[k], data[k === "a" ? "b" : "a"], clock)}`;
  return (
    <section aria-labelledby="compare-pulse" className="mb-4 border-y border-rule py-3">
      <Heading text={l.livePulse} />
      <p className="text-body-sm text-ink/70">
        {fill(l.comparePulseHelp, { min: everyMin, span })}
      </p>
      <p className={`mt-1 ${LABEL}`}>{clock.zone}</p>
      <div className="mt-3 grid gap-4">
        {sides.map((k) => (
          <div key={k}>
            <p className="font-medium">{label(k)}</p>
            <p className="mb-2 text-body-sm tabular-nums text-ink/70">
              {busiestText(own[k], everyMin, clock, copy, locale)}
            </p>
            <PulseStrip
              columns={columns}
              clock={own[k]}
              most={most}
              everyMin={everyMin}
              zone={clock}
              copy={copy}
              locale={locale}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 text-body-sm text-ink/70">
        <PulseLegend pulse={all.flatMap((c) => c.slots)} copy={copy} />
      </div>
      <PulseDetails
        columns={columns}
        events={sides.map((k) => ({ key: k, label: label(k), clock: own[k] }))}
        clock={clock}
        everyMin={everyMin}
        copy={copy}
        locale={locale}
        lead={l.livePulse}
      />
    </section>
  );
}
