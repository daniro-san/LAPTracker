// "Standing over time" on the alliance page (D90, issue 274): one sentence, then the tracked alliances
// ranked by might on the newest complete daily read, each with its rank change, might, might growth against
// the tracked alliances' total, and a small rank line; the ranks day by day sit under Details. Alliance
// totals only, public. The page's own alliance and the viewer's ("My alliance") are marked.
import { fill, type Dictionary } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { allianceStanding, type Standing as Figures } from "@/lib/queries";
import type { StandingRow } from "@/lib/standing";

import { Sparkline } from "./charts/Sparkline";
import { allianceLabel, percentText, rowAnchor, type Clock } from "./format";
import { requestLocale } from "./locale";
import { MineMark } from "./MyAlliance";
import { Num, Rank } from "./Num";
import { AllianceBadge } from "./Pictures";
import { StandingList } from "./StandingList";

const MUTED = "text-ink/70";

/** `OGs was #4 by might on Nov 16 and #6 on Nov 9. Its might changed +3.1% since then; …`. */
function lead(row: StandingRow, s: Figures, clock: Clock, locale: string, copy: Dictionary) {
  const from = clock.day(day(s.days[0]));
  const to = clock.day(day(s.days.at(-1)));
  const rank = fill(copy.standing.lead, {
    label: allianceLabel(row.tag ?? String(row.unionId), row.name),
    rank: `#${row.rank}`,
    before: `#${row.ranks[0]}`,
    from,
    to,
  });
  const growth =
    row.growth !== null && s.serverGrowth !== null
      ? fill(copy.standing.leadGrowth, {
          growth: percentText(row.growth, locale),
          server: percentText(s.serverGrowth, locale),
        })
      : null;
  return endDate(endDate([rank, growth].filter(Boolean).join(" "), from), to);
}

/** A short date can end with a full stop ("23 окт."): where the sentence's own full stop follows the date,
 * one is kept. Only the date is touched, so an alliance name with ".." stays as it is. */
const endDate = (text: string, date: string) =>
  date.endsWith(".") ? text.replaceAll(`${date}.`, date) : text;

const day = (d: string | undefined) => new Date(`${d}T12:00:00Z`);

function Row({
  row,
  s,
  own,
  clock,
  locale,
  copy,
}: {
  row: StandingRow;
  s: Figures;
  own: boolean;
  clock: Clock;
  locale: string;
  copy: Dictionary;
}) {
  const [first, last] = [s.days[0], s.days.at(-1)];
  const [t0, t1] = [day(first).getTime(), day(last).getTime()];
  const label = allianceLabel(row.tag ?? String(row.unionId), row.name);
  return (
    <li
      id={rowAnchor(row.unionId)}
      aria-current={own ? "true" : undefined}
      className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-2 border-l-4 border-transparent px-1 py-1.5 has-[[data-mine]]:bg-yarn/15 aria-[current=true]:border-plum aria-[current=true]:bg-plum/10 sm:grid-cols-[4.5rem_minmax(0,1fr)_6rem_9rem_4.5rem]"
    >
      <Rank n={row.rank} move={row.move} />
      <span className="flex min-w-0 items-center gap-2">
        <AllianceBadge badgeId={row.badgeId} />
        <span className="min-w-0 break-words">
          {label}
          {own && (
            <span className="ml-2 inline-block border border-ink/40 px-1.5 text-xs font-medium">
              {copy.standing.thisAlliance}
            </span>
          )}
          <MineMark unionId={row.unionId} />
        </span>
      </span>
      <span className="col-start-2 row-start-2 flex flex-wrap gap-x-3 text-sm tabular-nums sm:contents">
        <span className="sm:text-right">
          <Num n={row.might} />
        </span>
        <span className={`sm:text-right ${MUTED}`}>
          {row.growth === null
            ? "—"
            : fill(copy.standing.growthSince, {
                growth: percentText(row.growth, locale),
                from: clock.day(day(first)),
              })}
        </span>
      </span>
      <span className="col-start-3 row-span-2 row-start-1 justify-self-end sm:col-start-5 sm:row-span-1 sm:row-start-1">
        <Sparkline
          label={`${label}: ${fill(copy.standing.trend, {
            first: `#${row.ranks[0]}`,
            from: clock.day(day(first)),
            last: `#${row.rank}`,
            to: clock.day(day(last)),
          })}`}
          points={s.days.map((d, i) => ({
            at: t1 === t0 ? 0.5 : (Date.parse(`${d}T12:00:00Z`) - t0) / (t1 - t0),
            rank: row.ranks[i] ?? row.rank,
          }))}
        />
      </span>
    </li>
  );
}

/** The ranks day by day: one row per alliance, the ranks oldest first. */
function RanksTable({ s, clock, copy }: { s: Figures; clock: Clock; copy: Dictionary }) {
  return (
    <details className="mt-2">
      <summary className="text-button flex min-h-11 w-fit items-center underline underline-offset-2">
        {copy.ledger.details}
      </summary>
      <p className={`mb-1 text-xs ${MUTED}`}>
        {endDate(
          fill(copy.standing.detailsHelp, {
            days: s.days.map((d) => clock.day(day(d))).join(", "),
          }),
          clock.day(day(s.days[s.days.length - 1])),
        )}
      </p>
      <table className="w-full border-collapse text-sm tabular-nums">
        <tbody>
          {s.rows.map((r) => (
            <tr key={r.unionId} className="border-b border-rule last:border-0">
              <th scope="row" className="py-1 pr-2 text-left align-top font-normal">
                {allianceLabel(r.tag ?? String(r.unionId), null)}
              </th>
              <td className="py-1 text-right">{r.ranks.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** The alliances read before the period but not in it, left out of the list. */
function NotRanked({ list, copy }: { list: Figures["notRanked"]; copy: Dictionary }) {
  if (list.length === 0) return null;
  const names = list.map((a) => allianceLabel(a.tag ?? String(a.unionId), a.name)).join(", ");
  return (
    <p className={`mt-2 text-sm ${MUTED}`}>{fill(copy.standing.notRanked, { list: names })}</p>
  );
}

function StandingBody({
  standing,
  unionId,
  clock,
  locale,
  copy,
}: {
  /** null: fewer than two complete daily reads. */
  standing: Figures | null;
  /** The page's own alliance. */
  unionId: number;
  clock: Clock;
  locale: string;
  copy: Dictionary;
}) {
  const own = standing?.rows.find((r) => r.unionId === unionId);
  return (
    <section aria-labelledby="standing-h" className="mt-8">
      <h2 id="standing-h" className="font-subhead text-display-md">
        {copy.standing.title}
      </h2>
      {!standing ? (
        <p className={`text-sm ${MUTED}`}>{copy.standing.few}</p>
      ) : (
        <>
          {own && <p className="mt-1 text-lg">{lead(own, standing, clock, locale, copy)}</p>}
          <p className={`mb-2 text-body-sm ${MUTED}`}>
            {endDate(
              fill(copy.standing.help, { from: clock.day(day(standing.days[0])) }),
              clock.day(day(standing.days[0])),
            )}
          </p>
          <StandingList
            own={unionId}
            head={
              <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-2 border-l-4 border-transparent px-1 py-1.5 text-sm font-medium tabular-nums sm:grid-cols-[4.5rem_minmax(0,1fr)_6rem_9rem_4.5rem]">
                <span aria-hidden="true" />
                <span className="min-w-0 break-words text-base">{copy.standing.server}</span>
                <span className="col-start-2 flex flex-wrap gap-x-3 sm:contents">
                  <span className="sm:text-right">
                    <Num n={standing.serverMight} />
                  </span>
                  <span className={`font-normal sm:text-right ${MUTED}`}>
                    {standing.serverGrowth === null
                      ? "—"
                      : fill(copy.standing.growthSince, {
                          growth: percentText(standing.serverGrowth, locale),
                          from: clock.day(day(standing.days[0])),
                        })}
                  </span>
                </span>
              </li>
            }
            rows={standing.rows.map((r) => ({
              t: { unionId: r.unionId },
              node: (
                <Row
                  key={r.unionId}
                  row={r}
                  s={standing}
                  own={r.unionId === unionId}
                  clock={clock}
                  locale={locale}
                  copy={copy}
                />
              ),
            }))}
          />
          <NotRanked list={standing.notRanked} copy={copy} />
          <RanksTable s={standing} clock={clock} copy={copy} />
        </>
      )}
    </section>
  );
}

/** The section for the alliance page: reads every alliance's daily totals apart from the page's own read. */
export async function AllianceStanding({
  unionId,
  clock,
  copy,
}: {
  unionId: number;
  clock: Clock;
  copy: Dictionary;
}) {
  const [standing, locale] = await Promise.all([
    withPageDb((db) => allianceStanding(db, new Date())),
    requestLocale(),
  ]);
  return (
    <StandingBody standing={standing} unionId={unionId} clock={clock} locale={locale} copy={copy} />
  );
}
