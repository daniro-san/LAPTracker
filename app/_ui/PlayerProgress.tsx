// What the player page's growth card (issue 824) keeps of "Daily progress" (issue 270): the summary line
// (the might change over the last 7 days next to the alliance's median member), the events' Start-to-End
// windows with their readings as hollow dots, and the note under the might chart. `Kind` names a reading in
// the day by day.
import type { Dictionary } from "@/lib/copy";
import type { PlayerProgress as Progress, ProgressReading } from "@/lib/queries";
import { fill } from "@/lib/words";

import { EventLabel } from "./EventLabel";
import { allianceLabel, compact, percent, percentText, signOf, type Clock } from "./format";

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
export function bandsOf(readings: ProgressReading[]) {
  const byEvent = new Map<number, { from?: Date; to?: Date }>();
  for (const r of readings) {
    if (!r.event) continue;
    const side = r.event.phase === "before" ? "from" : "to";
    byEvent.set(r.event.id, { ...byEvent.get(r.event.id), [side]: r.at });
  }
  return [...byEvent.values()].flatMap((b) => (b.from && b.to ? [{ from: b.from, to: b.to }] : []));
}

/** Under the might chart: the events' key with their dates, and that war events cost might. */
export function EventNote({
  bands,
  clock,
  copy,
}: {
  bands: { from: Date; to: Date }[];
  clock: Clock;
  copy: Dictionary;
}) {
  const l = copy.ledger;
  // The latest events only: a year of weekly events would not fit a line.
  const dates = bands
    .slice(-6)
    .map((b) => clock.day(b.from).replace(/ /g, " "))
    .join(", ");
  return (
    <p className={`mt-2 flex flex-wrap items-center gap-x-3 text-sm ${MUTED}`}>
      {bands.length > 0 && (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-3 w-3 shrink-0 items-center justify-center border-x border-dashed border-ink/50 bg-ink/10"
          >
            <span className="size-2 rounded-full border-2 border-ink bg-paper" />
          </span>
          {fill(l.progressEvents, { dates })}
        </span>
      )}
      <span>{l.progressWar}</span>
    </p>
  );
}

/** What was read: the daily update, or an event's Start or End. */
export function Kind({ r, clock, copy }: { r: ProgressReading; clock: Clock; copy: Dictionary }) {
  if (!r.event) return <>{copy.history.daily}</>;
  return (
    <>
      <EventLabel event={r.event} clock={clock} /> ·{" "}
      {r.event.phase === "before" ? copy.status.start : copy.status.end}
    </>
  );
}
