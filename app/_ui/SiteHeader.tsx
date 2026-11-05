// Sticky compact header (DESIGN.md `header`): plum field with the mark and wordmark, a link to player
// search, the event selector and the theme switch, and the lace border hanging below. The selector is
// a <details> list of links, so it needs no JavaScript and every target is ≥ 44 px. Below 640 px the
// wordmark is screen-reader only: the mark, three controls and the gutters fill 360 px.
import Link from "next/link";

import { LaceBorder } from "@/lib/brand/components/LaceBorder";
import { WaxedMark } from "@/lib/brand/components/Logo";
import { ThemeSwitch } from "@/lib/brand/components/ThemeSwitch";
import { copy } from "@/lib/copy";

import { utcDayWithWeekday } from "./format";

export interface SelectorEvent {
  id: number;
  eventAtUtc: Date;
}

/** Plum-header controls: a paper tint on hover, deeper while pressed or open, so they feel tappable. */
const CONTROL =
  "rounded-xs transition-colors duration-150 hover:bg-paper/15 active:bg-paper/25 motion-reduce:transition-none";

function EventSelector({
  events,
  currentId,
}: {
  events: SelectorEvent[];
  currentId: number | null;
}) {
  const current = events.find((e) => e.id === currentId);
  return (
    <details className="group relative">
      <summary
        className={`flex min-h-11 cursor-pointer items-center gap-1 border border-paper/50 px-3 text-sm font-medium group-open:bg-paper/20 [&::-webkit-details-marker]:hidden ${CONTROL}`}
      >
        {current ? utcDayWithWeekday(current.eventAtUtc) : "Events"}{" "}
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
              {utcDayWithWeekday(e.eventAtUtc)}
              {i === 0 && <span className="ml-2 text-xs text-ink/70">latest</span>}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function SiteHeader({
  events,
  currentId,
  section,
}: {
  events: SelectorEvent[];
  currentId: number | null;
  /** Marks the header link of the section the page belongs to. */
  section?: "players";
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
          <div className="flex items-center gap-1">
            <Link
              href="/players"
              aria-current={section === "players" ? "page" : undefined}
              className={`flex min-h-11 items-center px-3 text-sm font-medium aria-[current=page]:bg-paper/20 ${CONTROL}`}
            >
              {copy.site.players}
            </Link>
            {events.length > 0 && <EventSelector events={events} currentId={currentId} />}
            <ThemeSwitch label={copy.site.darkMode} />
          </div>
        </div>
      </div>
      <LaceBorder className="block" />
    </header>
  );
}
