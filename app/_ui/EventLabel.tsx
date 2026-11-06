// How an event is named (D49): by its title, i.e. a manual round's name (D28) or the name the owner gave
// a scheduled event (D39), and by its weekday while a scheduled event keeps its generated name, which is
// English and says no more than the date. A manual round also carries the ✎ mark.
import type { Dictionary } from "@/lib/copy";
import { isGeneratedName } from "@/lib/schedule";

import type { Clock } from "./format";

export interface LabeledEvent {
  name: string;
  manual: boolean;
  eventAtUtc: Date;
}

/** The event's title, or null while it keeps its generated name. */
export const eventTitle = (e: { name: string; manual: boolean }) =>
  e.manual || !isGeneratedName(e.name) ? e.name : null;

/** The manual round's mark: a pen to the eye, the words to a screen reader. */
export function ManualMark({ copy }: { copy: Dictionary }) {
  return (
    <>
      <span aria-hidden="true">✎</span>
      <span className="sr-only">{copy.site.manualRound}: </span>
    </>
  );
}

export function EventLabel({ event, clock }: { event: LabeledEvent; clock: Clock }) {
  return <>{eventTitle(event) ?? clock.weekday(event.eventAtUtc)}</>;
}
