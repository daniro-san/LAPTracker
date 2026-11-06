// The lead of a history row: the event's day, then the time its figures are from in muted text
// (`Sat, Oct 31 · 14:00 server time`). A before-fallback row reads `10:00` without needing a word (07c S1).
import type { Clock } from "./format";

export function EventLead({
  eventAt,
  dataAt,
  clock,
}: {
  eventAt: Date;
  dataAt: Date | null;
  clock: Clock;
}) {
  return (
    <>
      {clock.weekday(eventAt)}
      {dataAt && (
        <span className="ml-2 whitespace-nowrap font-body text-sm font-normal text-ink/70">
          {clock.time(dataAt)}
        </span>
      )}
    </>
  );
}
