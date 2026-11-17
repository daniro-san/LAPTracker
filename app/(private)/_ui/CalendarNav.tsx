// The Calendar tab's own views (issue 300, prototype v5): Week · Caravans · Notices · Thefts, as links, so the
// address says which one is open. Every link is 44 px tall; the columns follow the list's length. Under them,
// "See what members see" opens the members' board (D105).
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";

export type CalendarView = "week" | "caravans" | "notices" | "thefts";

/** Only the calendar's own views keep the week shown (`?week=`). */
const VIEWS: { id: CalendarView; path: string; key: WorkspaceKey; keepsWeek: boolean }[] = [
  { id: "week", path: "/calendar", key: "calendar.nav.week", keepsWeek: true },
  { id: "caravans", path: "/calendar/caravans", key: "calendar.nav.caravans", keepsWeek: true },
  { id: "notices", path: "/notices", key: "calendar.nav.notices", keepsWeek: false },
  { id: "thefts", path: "/thefts", key: "thefts.nav", keepsWeek: false },
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
      <ul
        className="grid border border-plum"
        style={{ gridTemplateColumns: `repeat(${VIEWS.length}, minmax(0, 1fr))` }}
      >
        {VIEWS.map((v) => (
          <li key={v.id} className="min-w-0">
            <a
              href={`/w/${slug}${v.path}${v.keepsWeek ? query : ""}`}
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
      {/* D105: what the "for members" switches on these views put on the members' board. */}
      <p className="text-right">
        <a
          href={`/w/${slug}/board`}
          className="inline-flex min-h-11 items-center text-body-sm font-semibold text-plum underline underline-offset-4"
        >
          {t["board.seeMembers"]}
        </a>
      </p>
    </nav>
  );
}
