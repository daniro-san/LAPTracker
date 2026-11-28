// /alliances' "Race to #1" section (issue 285), while its flag is on (D91): a slope chart from each top
// alliance's place by might today (left) to its place in RACE_AHEAD weeks at this pace (right). Both sides are
// the same scale, one 44 px row per place, so a line's slope is the places moved. The SVG draws the lines only
// (D68); the places and tags are HTML, and a tap on a row reads its numbers out under the chart (D158 rule 7
// (a)): the pace, the slowest and the fastest week. Alliances left out are named with the reason.
import { type Dictionary } from "@/lib/copy";
import { isOn } from "@/lib/flags";
import { RACE_AHEAD, RACE_WEEKS, type RaceRow } from "@/lib/queries";
import { fill } from "@/lib/words";

import { Readout, type ReadoutItem } from "./charts/Readout";
import { allianceLabel, compact, dayDate, signOf, type Clock } from "./format";
import { sharedRace } from "./public-reads";
import { RaceLines, type RaceLine } from "./RaceLines";

const ROW =
  "flex h-11 cursor-pointer items-center gap-1 tabular-nums aria-[current=true]:bg-plum/10 aria-[current=true]:font-semibold aria-[current=true]:text-plum";

const tagOf = (r: RaceRow) => allianceLabel(r.tag ?? String(r.unionId), null);
const signed = (n: number, locale: string) => `${signOf(n)}${compact(Math.abs(n), locale)}`;

function readout(rows: RaceRow[], locale: string, copy: Dictionary): ReadoutItem[] {
  return rows.map((r) => ({
    label: allianceLabel(r.tag ?? String(r.unionId), r.name),
    line: fill(copy.race.line, {
      places: `#${r.rank} → #${r.projectedRank}`,
      weeks: RACE_AHEAD,
      pace: signed(r.pace, locale),
      low: signed(r.low, locale),
      high: signed(r.high, locale),
    }),
  }));
}

/** The two columns of places and the lines between them; `rows` by today's place. Capped in width, so the
 * lines stay next to their labels on a wide screen; the middle is narrow on a phone, so tags fit. */
function Slope({ rows, copy }: { rows: RaceRow[]; copy: Dictionary }) {
  const ahead = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.projectedRank - b.r.projectedRank || a.i - b.i);
  const at = new Map(ahead.map(({ i }, place) => [i, place]));
  const lines: RaceLine[] = rows.map((r, i) => ({
    at: i,
    from: i + 0.5,
    to: (at.get(i) ?? i) + 0.5,
    heavy: (r.projectedRank === 1 && r.rank !== 1) || Math.abs(r.rank - r.projectedRank) >= 2,
  }));
  return (
    <div className="mx-auto grid max-w-xl grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] gap-x-2 text-body-sm sm:grid-cols-[minmax(0,1fr)_minmax(6rem,1.5fr)_minmax(0,1fr)]">
      <p id="race-today" className="text-ink/70">
        {copy.race.today}
      </p>
      <span />
      <p id="race-ahead" className="text-right text-ink/70">
        {fill(copy.race.ahead, { weeks: RACE_AHEAD })}
      </p>
      <ol aria-labelledby="race-today">
        {rows.map((r, i) => (
          <li key={r.unionId} data-at={i} className={`${ROW} pl-1`}>
            <span className="w-8 shrink-0">#{r.rank}</span>
            <bdi className="min-w-0 truncate">{tagOf(r)}</bdi>
          </li>
        ))}
      </ol>
      <RaceLines lines={lines} />
      <ol aria-labelledby="race-ahead">
        {ahead.map(({ r, i }) => (
          <li key={r.unionId} data-at={i} className={`${ROW} justify-end pr-1`}>
            {/* Spoken place first ("#1, [IRT]"); seen tag first, beside its line. */}
            <span className="sr-only">#{r.projectedRank}, </span>
            <bdi className="min-w-0 truncate">{tagOf(r)}</bdi>
            <span aria-hidden="true" className="w-8 shrink-0 text-right">
              #{r.projectedRank}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** "[IRT] passes [LNK] for #1 at this pace.", or "[LNK] keeps #1 at this pace." */
function summary(rows: RaceRow[], copy: Dictionary): string | null {
  const leader = rows.find((r) => r.rank === 1);
  const first = rows.find((r) => r.projectedRank === 1);
  if (!leader || !first) return null;
  if (leader.projectedRank === 1) return fill(copy.race.keeps, { leader: tagOf(leader) });
  return fill(copy.race.passes, { first: tagOf(first), leader: tagOf(leader) });
}

export async function RacePace({
  clock,
  locale,
  copy,
}: {
  clock: Clock;
  locale: string;
  copy: Dictionary;
}) {
  if (!(await isOn("race-pace"))) return null;
  const race = await sharedRace();
  const c = copy.race;
  const rows = race?.rows ?? [];
  // With no pace at all, "not enough weeks" already says it; only a membership change is named on its own.
  const notes = (race?.left ?? []).filter((l) => rows.length > 0 || l.reason === "moved");
  return (
    <section aria-labelledby="race-h" id="race" className="mt-6 scroll-mt-20">
      <h2 id="race-h" className="font-subhead text-display-md">
        {c.title}
      </h2>
      {race === null || rows.length === 0 ? (
        <p className="mt-1 text-body-sm text-ink/70">{fill(c.none, { n: RACE_WEEKS })}</p>
      ) : (
        <>
          <p className="mb-2 max-w-[65ch] text-body-sm text-ink/70">
            {fill(c.lead, {
              weeks: RACE_AHEAD,
              n: RACE_WEEKS,
              from: clock.day(dayDate(race.from)),
              to: clock.day(dayDate(race.to)),
            })}
          </p>
          <p className="mb-2 font-semibold">{summary(rows, copy)}</p>
          <Readout
            id="race"
            items={readout(rows, locale, copy)}
            initial={0}
            words={{ earlier: c.previous, later: c.next }}
          >
            <Slope rows={rows} copy={copy} />
          </Readout>
          {notes.length > 0 && <p className="mt-1 text-body-sm text-ink/70">{c.among}</p>}
        </>
      )}
      {notes.length > 0 && (
        <ul className="mt-1 text-body-sm text-ink/70">
          {notes.map((l) => (
            <li key={l.unionId}>
              <bdi>
                {fill(l.reason === "moved" ? c.moved : c.few, {
                  label: allianceLabel(l.tag ?? String(l.unionId), l.name),
                })}
              </bdi>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
