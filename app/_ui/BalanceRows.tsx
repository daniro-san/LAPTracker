// The server balance page's alliance list and trend (D85, issue 283). Each row is one alliance: its share
// and might, and two GET links, A and B, that put it in a bloc or take it out (the state is the URL, so a
// tap needs no script and the link can be shared). Each link goes back to its own row. No member is named.
import Link from "next/link";

import {
  blocFigures,
  tap,
  type BalanceAlliance,
  type Blocs,
  type ConcentrationPoint,
  type Side,
  TOP_N,
} from "@/lib/balance";
import { type Dictionary } from "@/lib/copy";
import { isOn } from "@/lib/flags";
import { fill } from "@/lib/words";

import { balanceHref, BLOC_FILL, sideOf } from "./BalanceBar";
import { LineChart } from "./charts/LineChart";
import { allianceLabel, rowAnchor, sharePreciseText, type Clock } from "./format";
import { Num } from "./Num";
import { AllianceBadge } from "./Pictures";

const MUTED = "text-ink/70";

/** The A or B tap of one row: filled with a check mark while the alliance is in that bloc. */
function TapLink({
  a,
  side,
  blocs,
  copy,
}: {
  a: BalanceAlliance;
  side: Side;
  blocs: Blocs;
  copy: Dictionary;
}) {
  const on = blocs[side].includes(a.unionId);
  const label = allianceLabel(a.tag ?? String(a.unionId), a.name);
  const bloc = side.toUpperCase();
  return (
    <Link
      href={balanceHref(tap(blocs, a.unionId, side), `#${rowAnchor(a.unionId)}`)}
      scroll={false}
      aria-label={fill(on ? copy.balance.removeFrom : copy.balance.addTo, {
        alliance: label,
        bloc,
      })}
      className={`drawn-frame-soft tint-button inline-flex min-h-11 min-w-11 items-center justify-center gap-1 px-2 text-sm font-semibold ${on ? BLOC_FILL[side] : "text-ink"}`}
    >
      {on && <span aria-hidden="true">✓</span>}
      <span aria-hidden="true">{bloc}</span>
    </Link>
  );
}

/** What each bloc holds, kept in view while the list scrolls so a tap's result is never off screen. */
function BlocStrip({
  alliances,
  blocs,
  locale,
  copy,
}: {
  alliances: BalanceAlliance[];
  blocs: Blocs;
  locale: string;
  copy: Dictionary;
}) {
  if (blocs.a.length + blocs.b.length === 0) return null;
  return (
    <p className="sticky top-[calc(var(--site-header)-var(--lace))] z-20 flex flex-wrap gap-x-4 border-b border-rule bg-paper pb-1 pt-[calc(0.25rem+var(--lace))] text-sm font-medium tabular-nums">
      <span className="text-xs font-medium uppercase tracking-[0.04em] text-ink/70">
        {copy.balance.hypothetical}
      </span>
      {(["a", "b"] as const).map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block size-3 ${BLOC_FILL[s]}`} />
          {fill(copy.balance.bloc, { bloc: s.toUpperCase() })}{" "}
          {sharePreciseText(blocFigures(alliances, blocs[s]).share, locale)}
        </span>
      ))}
    </p>
  );
}

/** The list: greatest might first, with each alliance's share and might and its two taps. */
export function BalanceRows({
  alliances,
  blocs,
  total,
  newest,
  locale,
  clock,
  copy,
}: {
  alliances: BalanceAlliance[];
  blocs: Blocs;
  total: number;
  /** The newest read's time; an alliance read before that day says so. */
  newest: Date;
  locale: string;
  clock: Clock;
  copy: Dictionary;
}) {
  return (
    <section aria-labelledby="alliances-h" className="mt-8">
      <h2 id="alliances-h" className="sr-only">
        {copy.ledger.alliance}
      </h2>
      <BlocStrip alliances={alliances} blocs={blocs} locale={locale} copy={copy} />
      <ol className="divide-y divide-rule">
        {alliances.map((a) => {
          const side = sideOf(blocs, a.unionId);
          const older = clock.day(a.at) !== clock.day(newest);
          return (
            <li
              key={a.unionId}
              id={rowAnchor(a.unionId)}
              data-bloc={side ?? undefined}
              className="scroll-mt-32 px-1 py-1.5 data-[bloc=a]:bg-plum/10 data-[bloc=b]:bg-yarn/10 sm:flex sm:items-center sm:gap-6"
            >
              <div className="flex items-center gap-2 sm:flex-1">
                <AllianceBadge badgeId={a.badgeId} />
                <span className="min-w-0 flex-1 name-fit">
                  {allianceLabel(a.tag ?? String(a.unionId), a.name)}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {sharePreciseText(a.might / total, locale)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 sm:mt-0 sm:w-56">
                <p className={`min-w-0 text-sm tabular-nums ${MUTED}`}>
                  <Num n={a.might} />
                  {older && <> · {fill(copy.balance.asOf, { date: clock.day(a.at) })}</>}
                </p>
                <div className="flex shrink-0 gap-2">
                  <TapLink a={a} side="a" blocs={blocs} copy={copy} />
                  <TapLink a={a} side="b" blocs={blocs} copy={copy} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The top share over time: a line, the first and last values in a sentence, every day in a table while
 * the `chart-details` flag is on (D91). */
export async function BalanceTrend({
  trend,
  locale,
  clock,
  copy,
}: {
  trend: ConcentrationPoint[];
  locale: string;
  clock: Clock;
  copy: Dictionary;
}) {
  const details = await isOn("chart-details");
  const first = trend[0];
  const last = trend.at(-1);
  const b = copy.balance;
  return (
    <section aria-labelledby="trend-h" className="mt-8">
      <h2 id="trend-h" className="font-subhead text-display-md">
        {fill(b.trend, { n: TOP_N })}
      </h2>
      <p className={`mb-2 text-body-sm ${MUTED}`}>{fill(b.trendHelp, { n: TOP_N })}</p>
      {!first || !last || trend.length < 2 ? (
        <p className={`text-sm ${MUTED}`}>{b.trendFew}</p>
      ) : (
        <div className="border border-rule p-3">
          <p className="mb-3">
            {fill(b.trendSummary, {
              n: TOP_N,
              last: sharePreciseText(last.top, locale),
              to: clock.day(last.at),
              first: sharePreciseText(first.top, locale),
              from: clock.day(first.at),
            })}
          </p>
          <LineChart
            points={trend.map((p) => ({ at: p.at, value: p.top }))}
            label={fill(b.trendLabel, { n: TOP_N })}
            value={(n) => sharePreciseText(n, locale)}
            date={clock.day}
            time={clock.hhmm}
            copy={copy}
            readout={{ id: "top" }}
          />
          {details && <TrendTable trend={trend} locale={locale} clock={clock} copy={copy} />}
        </div>
      )}
    </section>
  );
}

/** Every day of the trend, newest first, under Details. */
function TrendTable({
  trend,
  locale,
  clock,
  copy,
}: {
  trend: ConcentrationPoint[];
  locale: string;
  clock: Clock;
  copy: Dictionary;
}) {
  const b = copy.balance;
  return (
    <details className="mt-2">
      <summary className="text-button flex min-h-11 w-fit items-center underline underline-offset-2">
        {copy.ledger.details}
      </summary>
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead className="text-xs text-ink/70">
          <tr className="border-b border-rule">
            <th scope="col" className="py-1 text-left font-normal">
              {b.day}
            </th>
            <th scope="col" className="py-1 pl-2 text-right font-medium">
              {fill(b.trendLabel, { n: TOP_N })}
            </th>
            <th scope="col" className="py-1 pl-2 text-right font-medium">
              {b.total}
            </th>
          </tr>
        </thead>
        <tbody>
          {[...trend].reverse().map((p) => (
            <tr key={p.day} className="border-b border-rule last:border-0">
              <th scope="row" className="py-1 text-left font-normal">
                {clock.day(p.at)}
              </th>
              <td className="py-1 pl-2 text-right">{sharePreciseText(p.top, locale)}</td>
              <td className="py-1 pl-2 text-right">
                <Num n={p.total} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
