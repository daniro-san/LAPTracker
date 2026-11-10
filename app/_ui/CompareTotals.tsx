// The compare page's totals band (D57): Might, Kills, Members changed during each event, and the
// difference between the two, over one set of alliances.
import { changeDifference } from "@/lib/compute";
import { fill, type Dictionary } from "@/lib/copy";
import type { EventComparison } from "@/lib/queries";

import { dash, eventHead, MUTED, versus } from "./EventCompare";
import type { Clock } from "./format";
import { Delta } from "./Num";
import { LABEL } from "./StatTable";

/** The server's totals: Might, Kills, Members changed during each event, over one set of alliances. */
export function CompareTotals({
  data,
  clock,
  copy,
}: {
  data: EventComparison;
  clock: Clock;
  copy: Dictionary;
}) {
  const t = data.totals;
  const column = (label: string, pick: (s: typeof t.a) => [number, number | null]) => {
    const diff = t.counted > 0 ? changeDifference(pick(t.a)[0], pick(t.b)[0]) : null;
    return (
      <div className="min-w-0">
        <p className={LABEL}>{label}</p>
        {(["a", "b"] as const).map((k) => {
          const [d, base] = pick(t[k]);
          return (
            <p key={k} className="text-sm leading-snug">
              <span className={`text-xs ${MUTED}`}>
                {eventHead(data[k], data[k === "a" ? "b" : "a"], clock)}{" "}
              </span>
              {t.counted > 0 ? <Delta delta={d} base={base} stack /> : dash(k)}
            </p>
          );
        })}
        <p className="mt-1 border-t border-rule pt-1 text-sm leading-snug">
          <span className={`block text-xs ${MUTED}`}>{versus(data, clock, copy)}</span>
          {diff ? (
            <Delta delta={diff.delta} base={pick(t.a)[1] === null ? null : diff.base} stack />
          ) : (
            dash("diff")
          )}
        </p>
      </div>
    );
  };
  return (
    <section className="mb-4 border-y border-rule py-3">
      <h2 className="font-subhead text-display-sm">{copy.compare.allAlliances}</h2>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {column(copy.ledger.might, (s) => [s.power, s.openingPower])}
        {column(copy.ledger.kills, (s) => [s.kills, s.openingKills])}
        {column(copy.ledger.members, (s) => [s.members, null])}
      </div>
      <p className={`mt-2 text-xs ${MUTED}`}>
        {fill(copy.compare.counted, { n: t.counted, total: t.of })}
      </p>
    </section>
  );
}
