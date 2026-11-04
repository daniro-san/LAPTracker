// Sticky compact header: home link, the "Exact numbers" switch and the event selector. The selector
// is a <details> list of links, so it needs no JavaScript and every target is ≥ 44 px.
import Link from "next/link";

import { utcDayWithWeekday } from "./format";

export interface SelectorEvent {
  id: number;
  eventAtUtc: Date;
}

function EventSelector({
  events,
  currentId,
}: {
  events: SelectorEvent[];
  currentId: number | null;
}) {
  const current = events.find((e) => e.id === currentId);
  return (
    <details className="relative">
      <summary className="flex min-h-11 cursor-pointer items-center gap-1 rounded-xs border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700 [&::-webkit-details-marker]:hidden">
        {current ? utcDayWithWeekday(current.eventAtUtc) : "Events"}{" "}
        <span aria-hidden="true">▾</span>
      </summary>
      <ul className="absolute right-0 z-40 mt-1 max-h-[70vh] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        {events.map((e, i) => (
          <li key={e.id}>
            <Link
              href={i === 0 ? "/" : `/events/${e.id}`}
              className={`flex min-h-11 items-center px-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${e.id === currentId ? "font-semibold" : ""}`}
            >
              {utcDayWithWeekday(e.eventAtUtc)}
              {i === 0 && <span className="ml-2 text-xs text-zinc-500">latest</span>}
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
}: {
  events: SelectorEvent[];
  currentId: number | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-[960px] items-center gap-2 px-4 py-1 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center text-base font-bold">
          LAPTracker
        </Link>
        <label className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            id="full-numbers"
            type="checkbox"
            className="size-5 accent-zinc-800 dark:accent-zinc-200"
          />
          Exact
        </label>
        {events.length > 0 && <EventSelector events={events} currentId={currentId} />}
      </div>
    </header>
  );
}
