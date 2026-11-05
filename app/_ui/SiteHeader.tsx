// Sticky compact header (DESIGN.md `header`): plum field with the mark and wordmark, player search (the
// magnifier and the word), the event selector and the theme switch, and the lace border hanging below. The selector is
// a <details> list of links, so it needs no JavaScript and every target is ≥ 44 px. Below 640 px the
// wordmark is screen-reader only: the mark, three controls and the gutters fill 360 px.
import Link from "next/link";

import { LaceBorder } from "@/lib/brand/components/LaceBorder";
import { WaxedMark } from "@/lib/brand/components/Logo";
import { ThemeSwitch } from "@/lib/brand/components/ThemeSwitch";
import { copy } from "@/lib/copy";

import type { Clock } from "./format";

export interface SelectorEvent {
  id: number;
  eventAtUtc: Date;
}

/** Plum-header controls: in the soft drawn frame (paper ink), a paper tint on hover, deeper while
 * pressed or open, so they feel tappable. */
const CONTROL =
  "rounded-xs transition-colors duration-150 hover:bg-paper/15 active:bg-paper/25 motion-reduce:transition-none";

function EventSelector({
  events,
  currentId,
  clock,
}: {
  events: SelectorEvent[];
  currentId: number | null;
  clock: Clock;
}) {
  const current = events.find((e) => e.id === currentId);
  return (
    <details className="group relative">
      <summary
        className={`flex min-h-11 cursor-pointer items-center gap-1 px-3 text-sm drawn-frame-soft font-medium group-open:bg-paper/20 [&::-webkit-details-marker]:hidden ${CONTROL}`}
      >
        {current ? clock.weekday(current.eventAtUtc) : copy.site.events}{" "}
        <span
          aria-hidden="true"
          className="transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
        >
          ▾
        </span>
      </summary>
      <ul className="absolute right-0 z-40 mt-1 max-h-[70vh] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto bg-paper p-1 text-ink drawn-frame before:inset-0">
        {events.map((e, i) => (
          <li key={e.id}>
            <Link
              href={i === 0 ? "/" : `/events/${e.id}`}
              aria-current={e.id === currentId ? "page" : undefined}
              className="flex min-h-11 items-center px-3 text-sm transition-colors duration-150 hover:bg-plum/15 aria-[current=page]:bg-plum/10 aria-[current=page]:font-semibold motion-reduce:transition-none"
            >
              {clock.weekday(e.eventAtUtc)}
              {i === 0 && <span className="ml-2 text-xs text-ink/70">{copy.site.latest}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </details>
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
}: {
  events: SelectorEvent[];
  currentId: number | null;
  /** Marks the header link of the section the page belongs to. */
  section?: "players";
  /** The request's clock (app/_ui/locale.ts) for the selector's dates; error pages have no events. */
  clock?: Clock;
}) {
  return (
    <header className="sticky top-0 z-30 text-plum">
      <div className="bg-plum text-paper">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-2 px-4 py-1 sm:px-6">
          <Link href="/" className="flex min-h-11 items-center gap-2">
            <WaxedMark size={40} />
            <span className="sr-only font-display text-display-sm font-semibold sm:not-sr-only">
              {copy.site.name}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/players"
              aria-current={section === "players" ? "page" : undefined}
              className={`drawn-frame-soft flex min-h-11 items-center gap-1.5 px-3 text-sm font-medium aria-[current=page]:bg-paper/20 ${CONTROL}`}
            >
              <Magnifier />
              {copy.site.players}
            </Link>
            {clock && events.length > 0 && (
              <EventSelector events={events} currentId={currentId} clock={clock} />
            )}
            <ThemeSwitch label={copy.site.darkMode} />
          </div>
        </div>
      </div>
      <LaceBorder className="block" />
    </header>
  );
}
