// Sticky compact header (DESIGN.md `header`): plum field with the mark and wordmark, player search (the
// magnifier and the word), the event selector and the settings gear (theme, times, dates), and the lace
// border hanging below.
// The selector is a <details> list of links, so it works without JavaScript and every target is ≥ 44 px;
// with it, Escape and a tap outside close it. Closed, it shows the event's date only, so it stays one
// line in any language (D49); its list and the page show the title. Below 640 px the wordmark is
// screen-reader only, and below 420 px so is the word next to the magnifier: in the longest languages
// (ja, pt-BR, fr) the word and the selector need up to 262 px, and 360 px leaves them 216.
import Link from "next/link";

import { LaceBorder } from "@/lib/brand/components/LaceBorder";
import { WaxedMark } from "@/lib/brand/components/Logo";
import type { Dictionary } from "@/lib/copy";

import { Disclosure } from "./Disclosure";
import { EventLabel, eventTitle, ManualMark, type LabeledEvent } from "./EventLabel";
import type { Clock } from "./format";
import { ViewerSettings } from "./ViewerSettings";

export interface SelectorEvent extends LabeledEvent {
  id: number;
}

/** Plum-header controls: in the soft drawn frame (paper ink), a paper tint on hover, deeper while
 * pressed or open, so they feel tappable. */
const CONTROL =
  "rounded-xs transition-colors duration-150 hover:bg-paper/15 active:bg-paper/25 motion-reduce:transition-none";

function EventSelector({
  events,
  currentId,
  clock,
  copy,
}: {
  events: SelectorEvent[];
  currentId: number | null;
  clock: Clock;
  copy: Dictionary;
}) {
  const current = events.find((e) => e.id === currentId);
  const title = current && eventTitle(current);
  return (
    <Disclosure label={copy.site.events} className="group relative">
      <summary
        className={`flex min-h-11 cursor-pointer items-center gap-1 whitespace-nowrap px-3 text-sm drawn-frame-soft font-medium group-open:bg-paper/20 [&::-webkit-details-marker]:hidden ${CONTROL}`}
      >
        {current ? (
          <>
            {current.manual && <ManualMark copy={copy} />}
            <span aria-hidden="true" className="hidden min-[360px]:inline">
              {clock.weekday(current.eventAtUtc)}
            </span>
            <span aria-hidden="true" className="min-[360px]:hidden">
              {clock.day(current.eventAtUtc)}
            </span>
            <span className="sr-only">
              {title ? `${title}, ` : ""}
              {clock.weekday(current.eventAtUtc)}
            </span>
          </>
        ) : (
          copy.site.allEvents
        )}{" "}
        <span
          aria-hidden="true"
          className="transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
        >
          ▾
        </span>
      </summary>
      <ul className="absolute right-0 z-40 mt-1 max-h-[70vh] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto bg-paper p-1 text-ink drawn-frame before:inset-0">
        {events.map((e, i) => {
          const named = eventTitle(e);
          return (
            <li key={e.id}>
              <Link
                href={i === 0 ? "/" : `/events/${e.id}`}
                aria-current={e.id === currentId ? "page" : undefined}
                className="flex min-h-11 flex-col justify-center px-3 py-1 text-sm transition-colors duration-150 hover:bg-plum/15 aria-[current=page]:bg-plum/10 aria-[current=page]:font-semibold motion-reduce:transition-none"
              >
                <span className="break-words">
                  <EventLabel event={e} clock={clock} />
                </span>
                {(named || i === 0) && (
                  <span className="flex gap-1.5 text-xs font-normal text-ink/70">
                    {e.manual && <ManualMark copy={copy} />}
                    {named && clock.weekday(e.eventAtUtc)}
                    {named && i === 0 && <span aria-hidden="true">·</span>}
                    {i === 0 && copy.site.latest}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </Disclosure>
  );
}

/** The universal search symbol (DESIGN.md), drawn in the header's ink. */
function Magnifier() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true" fill="none">
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12.6 12.6 17 17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function SiteHeader({
  events,
  currentId,
  section,
  clock,
  copy,
  publicPage = true,
}: {
  events: SelectorEvent[];
  currentId: number | null;
  /** Marks the header link of the section the page belongs to. */
  section?: "players";
  /** The request's clock (app/_ui/locale.ts) for the selector's dates; error pages have no events. */
  clock?: Clock;
  /** The request's words (requestCopy); /admin passes the English `copy`. */
  copy: Dictionary;
  /** The gear offers language, times and dates; /admin, English and in server time, the theme only. */
  publicPage?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 text-plum">
      <div className="bg-plum text-paper">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-2 px-4 py-1 sm:px-6">
          <Link href="/" className="flex min-h-11 min-w-11 items-center justify-center gap-2">
            <WaxedMark size={40} />
            <span className="sr-only font-display text-display-sm font-semibold sm:not-sr-only">
              {copy.site.name}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/players"
              aria-current={section === "players" ? "page" : undefined}
              className={`drawn-frame-soft flex min-h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium aria-[current=page]:bg-paper/20 ${CONTROL}`}
            >
              <Magnifier />
              <span className="sr-only min-[420px]:not-sr-only">{copy.site.players}</span>
            </Link>
            {clock && events.length > 0 && (
              <EventSelector events={events} currentId={currentId} clock={clock} copy={copy} />
            )}
            <ViewerSettings publicPage={publicPage} />
          </div>
        </div>
      </div>
      <LaceBorder className="block" />
    </header>
  );
}
