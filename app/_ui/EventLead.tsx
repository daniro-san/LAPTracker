// The lead of a history row: the event's day, then the time its figures are from in muted text
// (`Sat, Oct 31 · 14:00 server time`). A before-fallback row reads `10:00` without needing a word (07c S1).
// A time on another day than the event's, or an End on another day than its Start (`withDay`), carries its
// day (`Nov 6, 10:39 server time`, issue 473).
import type { Clock } from "./format";

export function EventLead({
  eventAt,
  dataAt,
  withDay = false,
  clock,
}: {
  eventAt: Date;
  dataAt: Date | null;
  withDay?: boolean;
  clock: Clock;
}) {
  return (
    <>
      {clock.weekday(eventAt)}
      {dataAt && (
        <span className="ml-2 font-body text-sm font-normal text-ink/70">
          {withDay || clock.day(dataAt) !== clock.day(eventAt)
            ? clock.at(dataAt)
            : clock.time(dataAt)}
        </span>
      )}
    </>
  );
}
