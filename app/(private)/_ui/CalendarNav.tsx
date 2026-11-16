// The Calendar tab's own views (issue 300, prototype v5): Week · Caravans · Notices, as links, so the
// address says which one is open. The thefts log (issue 321) adds a fourth. Every link is 44 px tall.
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

export type CalendarView = "week" | "caravans" | "notices";

const VIEWS: { id: CalendarView; path: string; key: `calendar.nav.${CalendarView}` }[] = [
  { id: "week", path: "/calendar", key: "calendar.nav.week" },
  { id: "caravans", path: "/calendar/caravans", key: "calendar.nav.caravans" },
  { id: "notices", path: "/notices", key: "calendar.nav.notices" },
];

export function CalendarNav({
  slug,
  current,
  t,
  query = "",
}: {
  slug: string;
  current: CalendarView;
  t: WorkspaceDictionary;
  /** Kept on the week and caravan links (the week shown), e.g. "?week=2026-11-23". */
  query?: string;
}) {
  return (
    <nav aria-label={t["calendar.nav.aria"]} className="mt-3">
      <ul className="grid grid-cols-3 border border-plum">
        {VIEWS.map((v) => (
          <li key={v.id} className="min-w-0">
            <a
              href={`/w/${slug}${v.path}${v.id === "notices" ? "" : query}`}
              aria-current={v.id === current ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center px-1 text-center text-body-sm font-semibold ${
                v.id === current ? "bg-plum text-paper" : "text-plum"
              }`}
            >
              {t[v.key]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
