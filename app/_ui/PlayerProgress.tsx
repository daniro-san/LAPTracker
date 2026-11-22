// "Daily progress" on the player page (issue 270): one summary line (the might change over the last 7
// days next to the alliance's median member), a might line and a smaller kills line over every reading
// with the events' Start-to-End windows shaded, a note that war events cost might, and every reading in a
// table under Details while the `chart-details` flag is on (D91). The same card at every width.
import type { Dictionary } from "@/lib/copy";
import { isOn } from "@/lib/flags";
import type { PlayerProgress as Progress, ProgressReading } from "@/lib/queries";
import { fill } from "@/lib/words";

import { LineChart } from "./charts/LineChart";
import { EventLabel } from "./EventLabel";
import { allianceLabel, compact, percent, percentText, signOf, type Clock } from "./format";
import { requestCopy, requestLocale } from "./locale";
import { Num, Rank } from "./Num";
import { LABEL, MoreBar } from "./StatTable";

const MUTED = "text-ink/70";

/** `You: +4.1% since Nov 9. Typical [OGs] member: +3.2%.` */
export function summaryText(p: Progress, clock: Clock, locale: string, copy: Dictionary) {
  const s = p.summary;
  if (!s) return null;
  const pct = percent(s.power, s.from.power);
  const change =
    pct === null ? `${signOf(s.power)}${compact(s.power, locale)}` : percentText(pct, locale);
  // A short date can end with a full stop ("24. Okt."): the sentence's own full stop would double it.
  const might = fill(copy.ledger.progressMight, { change, date: clock.day(s.from.at) }).replace(
    /\.\.$/,
    ".",
  );
  // No tag to name the alliance by: the sentence would read "Typical  member: …", so it is left out.
  const median =
    s.alliance?.tag &&
    fill(copy.ledger.progressMedian, {
      tag: allianceLabel(s.alliance.tag, null),
      percent: percentText(s.alliance.medianPercent, locale),
    });
  return median ? `${might} ${median}` : might;
}

/** Each event's window, from the player's Start reading to their End reading. */
function bandsOf(readings: ProgressReading[]) {
  const byEvent = new Map<number, { from?: Date; to?: Date }>();
  for (const r of readings) {
    if (!r.event) continue;
    const side = r.event.phase === "before" ? "from" : "to";
    byEvent.set(r.event.id, { ...byEvent.get(r.event.id), [side]: r.at });
  }
  return [...byEvent.values()].flatMap((b) => (b.from && b.to ? [{ from: b.from, to: b.to }] : []));
}

const pointsOf = (readings: ProgressReading[], key: "power" | "kills") =>
  readings.flatMap((r) => {
    const value = r[key];
    return value === null ? [] : [{ at: r.at, value, mark: r.event !== null }];
  });

function Kind({ r, clock, copy }: { r: ProgressReading; clock: Clock; copy: Dictionary }) {
  if (!r.event) return <>{copy.history.daily}</>;
  return (
    <>
      <EventLabel event={r.event} clock={clock} /> ·{" "}
      {r.event.phase === "before" ? copy.status.start : copy.status.end}
    </>
  );
}

/** Every reading, newest first: when and what was read, the alliance, Might, Kills and the rank. */
function ReadingsTable({
  readings,
  clock,
  copy,
}: {
  readings: ProgressReading[];
  clock: Clock;
  copy: Dictionary;
}) {
  const l = copy.ledger;
  const cell = "py-1 pl-2 text-right align-top";
  return (
    <table className="w-full border-collapse text-sm tabular-nums">
      <thead className="text-xs text-ink/70">
        <tr className="border-b border-rule">
          <th scope="col" className="py-1 text-left font-normal">
            {clock.zone}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {l.alliance}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {l.might}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {l.kills}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {l.rank}
          </th>
        </tr>
      </thead>
      <tbody>
        {[...readings].reverse().map((r) => (
          <tr key={`${r.at.getTime()}|${r.unionId}`} className="border-b border-rule last:border-0">
            <th scope="row" className="py-1 text-left align-top font-normal">
              <span className="block whitespace-nowrap">
                {clock.day(r.at)}, {clock.hhmm(r.at)}
              </span>
              <span className={`block break-words text-xs ${MUTED}`}>
                <Kind r={r} clock={clock} copy={copy} />
              </span>
            </th>
            <td className={cell}>{allianceLabel(r.tag, null)}</td>
            <td className={cell}>
              <Num n={r.power} />
            </td>
            <td className={cell}>
              <Num n={r.kills} />
            </td>
            <td className={cell}>
              <Rank n={r.rank} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export async function PlayerProgress({ progress, clock }: { progress: Progress; clock: Clock }) {
  const [copy, locale, details] = await Promise.all([
    requestCopy(),
    requestLocale(),
    isOn("chart-details"),
  ]);
  const l = copy.ledger;
  const { readings } = progress;
  const bands = bandsOf(readings);
  const chart = {
    bands,
    date: clock.day,
    time: clock.hhmm,
    value: (n: number) => compact(n, locale),
    copy,
  };
  // The latest events only: a year of weekly events would not fit a line.
  const eventDates = bands
    .slice(-6)
    .map((b) => clock.day(b.from).replace(/ /g, "\u00a0"))
    .join(", ");
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-subhead text-display-md">{l.progress}</h2>
      {readings.length < 2 ? (
        <p className={`text-sm ${MUTED}`}>{l.progressEmpty}</p>
      ) : (
        <div className="drawn-card p-3">
          <p className="mb-3">{summaryText(progress, clock, locale, copy)}</p>
          <h3 className={`mb-1 ${LABEL}`}>{l.might}</h3>
          <LineChart points={pointsOf(readings, "power")} label={l.might} {...chart} />
          <p className={`mt-2 flex flex-wrap items-center gap-x-3 text-sm ${MUTED}`}>
            {bands.length > 0 && (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="inline-block h-3 w-1.5 shrink-0 bg-ink/50" />
                {fill(l.progressEvents, { dates: eventDates })}
              </span>
            )}
            <span>{l.progressWar}</span>
          </p>
          <h3 className={`mb-1 mt-4 ${LABEL}`}>{l.kills}</h3>
          <LineChart points={pointsOf(readings, "kills")} label={l.kills} small {...chart} />
          {details && (
            <div className="mt-2">
              <MoreBar
                row={{
                  key: "readings",
                  lead: l.progress,
                  metrics: [],
                  detail: <ReadingsTable readings={readings} clock={clock} copy={copy} />,
                }}
                copy={copy}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
