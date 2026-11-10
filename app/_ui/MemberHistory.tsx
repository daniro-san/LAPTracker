// Member history (D60, issue 197): one collapsible card per stored roster, newest first. The head says when
// the data was read (a daily read, or an event's Start or End) and since when the card counts. Every
// card starts closed and fetches its contents when first opened (MemberHistoryBody). Below 640 px and
// above, the same card.
import { fill, type Dictionary } from "@/lib/copy";
import type { HistoryEntry } from "@/lib/queries";

import { EventLabel } from "./EventLabel";
import { type Clock } from "./format";
import type { HistoryFilter } from "./member-history";
import { LazyCardBody } from "./MemberHistoryBody";

const MUTED = "text-ink/70";

/** The card's summary: when the data was read (a daily read, or an event's Start or End) and since when,
 * with the ▾ that opens and closes it. The whole row is the 44 px control. */
function CardHead({ entry, clock, copy }: { entry: HistoryEntry; clock: Clock; copy: Dictionary }) {
  const h = copy.history;
  return (
    <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
      <div className="min-w-0">
        <h2 className="font-subhead text-display-sm leading-tight">
          {entry.event ? (
            <>
              <EventLabel event={entry.event} clock={clock} /> ·{" "}
              {entry.event.phase === "before" ? copy.status.start : copy.status.end}
            </>
          ) : (
            h.daily
          )}
        </h2>
        <p className={`text-sm ${MUTED}`}>
          {clock.at(entry.at)}
          {entry.since && <> · {fill(h.since, { time: clock.at(entry.since) })}</>}
        </p>
      </div>
      <span
        aria-hidden="true"
        className="text-plum transition-transform duration-150 group-open/card:rotate-180 motion-reduce:transition-none"
      >
        ▾
      </span>
    </summary>
  );
}

/** A collapsible card (native `<details>`), closed; its contents are fetched on the first open. */
export function HistoryCardView({
  unionId,
  entry,
  filter,
  clock,
  copy,
}: {
  unionId: number;
  entry: HistoryEntry;
  filter: HistoryFilter | null;
  clock: Clock;
  copy: Dictionary;
}) {
  return (
    <li className="mb-3 border border-rule">
      <details className="group/card">
        <CardHead entry={entry} clock={clock} copy={copy} />
        <LazyCardBody
          unionId={unionId}
          at={entry.at.toISOString()}
          filter={filter}
          first={entry.since === null}
        />
      </details>
    </li>
  );
}
