// How an event is named in the selector and at the top of its page: a real event by its weekday, a
// manual round (D28) by its name, as text, with a small "Manual round" tag.
import { copy } from "@/lib/copy";

import type { Clock } from "./format";

export interface LabeledEvent {
  name: string;
  manual: boolean;
  eventAtUtc: Date;
}

export function EventLabel({ event, clock }: { event: LabeledEvent; clock: Clock }) {
  if (!event.manual) return <>{clock.weekday(event.eventAtUtc)}</>;
  return (
    <>
      <span className="break-words">{event.name}</span>
      <span className="ml-2 rounded-xs border border-current px-1.5 text-xs font-normal">
        {copy.site.manualRound}
      </span>
    </>
  );
}
