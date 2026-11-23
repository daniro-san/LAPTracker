// One 15-minute interval's kills split by alliance (D158 rule 7 (b)): the next level of the server pulse and
// of a fight-clock strip, drawn in the chart's place under its path. Each alliance is one bar, its share of
// the kills the sum line adds up, the kills written beside it, most first. The parts are the ones
// `serverPulse` added up for the interval (`PulseSlot.parts`), so the sum line under them is the interval's
// own figure; it names the alliances it leaves out (not read fresh at both times), and says when the fight
// clock counted a loss as 0. Server-rendered, every number in HTML (D68).
import type { Dictionary } from "@/lib/copy";
import type { AlliancePart } from "@/lib/live";
import { fill } from "@/lib/words";

import { Bar } from "./charts/Bar";
import { compact, shareText } from "./format";

const signed = (n: number, locale: string) => `${n < 0 ? "−" : ""}${compact(n, locale)}`;

export function PulseSplit({
  parts,
  kills,
  read,
  times,
  labels,
  copy,
  locale,
}: {
  parts: readonly AlliancePart[];
  /** The interval's kills as its column draws them: the parts' sum, or 0 for a loss on the fight clock. */
  kills: number;
  /** The alliances the event's Start read: the ones not in `parts` were left out of this interval. */
  read: readonly number[];
  /** Its two readings, "10:45" and "11:00". */
  times: { from: string; to: string };
  /** Each alliance's "[TAG] Name". */
  labels: ReadonlyMap<number, string>;
  copy: Dictionary;
  locale: string;
}) {
  const l = copy.ledger;
  const sum = parts.reduce((a, p) => a + p.kills, 0);
  const whole = Math.max(0, kills);
  const rows = [...parts].sort((a, b) => b.kills - a.kills || a.unionId - b.unionId);
  const name = (id: number) => labels.get(id) ?? String(id);
  const counted = new Set(parts.map((p) => p.unionId));
  const out = read.filter((id) => !counted.has(id));
  return (
    <div>
      <p className="mt-2 text-body-sm text-ink/70">
        {fill(l.splitKey, { kills: signed(sum, locale) })}
      </p>
      <ul className="mt-1">
        {rows.map((p) => (
          <li key={p.unionId} className="border-t border-rule py-1.5">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
              <span className="min-w-0">{name(p.unionId)}</span>
              <span className="whitespace-nowrap tabular-nums">
                <span className="font-semibold">{signed(p.kills, locale)}</span>
                {whole > 0 && (
                  <span className="ml-2 text-ink/70">
                    {shareText(Math.max(0, p.kills) / whole, locale)}
                  </span>
                )}
              </span>
            </span>
            <Bar
              axis="row"
              share={whole > 0 ? p.kills / whole : 0}
              tone="bg-plum/60"
              className="mt-1 h-2 w-full bg-ink/10"
            />
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-rule pt-2 text-body-sm font-medium tabular-nums">
        {fill(l.splitSum, {
          kills: signed(sum, locale),
          span: `${times.from}–${times.to}`,
          n: parts.length,
          ...times,
        })}
      </p>
      {out.length > 0 && (
        <p className="text-body-sm text-ink/70">
          {fill(l.splitLeftOut, { names: out.map(name).join(", ") })}
        </p>
      )}
      {sum !== kills && <p className="text-body-sm text-ink/70">{l.splitLoss}</p>}
    </div>
  );
}
