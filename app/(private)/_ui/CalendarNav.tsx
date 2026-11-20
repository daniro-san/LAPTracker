// The Calendar tab's own views (issue 300, prototype v5): Week · Caravans · Notices · Thefts, as links, so the
// address says which one is open. Every link is 44 px tall; the columns follow the list's length. Under them,
// "See what members see" opens the members' board (D105).
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import type { Feature } from "@/lib/workspace-features";

export type CalendarView = "week" | "caravans" | "notices" | "thefts";

/** Only the calendar's own views keep the week shown (`?week=`); each view but Week has a switch (D126). */
const VIEWS: {
  id: CalendarView;
  path: string;
  key: WorkspaceKey;
  keepsWeek: boolean;
  feature?: Feature;
}[] = [
  { id: "week", path: "/calendar", key: "calendar.nav.week", keepsWeek: true },
  {
    id: "caravans",
    path: "/calendar/caravans",
    key: "calendar.nav.caravans",
    keepsWeek: true,
    feature: "caravans",
  },
  {
    id: "notices",
    path: "/notices",
    key: "calendar.nav.notices",
    keepsWeek: false,
    feature: "notices",
  },
  { id: "thefts", path: "/thefts", key: "thefts.nav", keepsWeek: false, feature: "thefts" },
];

export function CalendarNav({
  slug,
  current,
  t,
  query = "",
  on,
}: {
  slug: string;
  current: CalendarView;
  t: WorkspaceDictionary;
  /** Kept on the week and caravan links (the week shown), e.g. "?week=2026-11-23". */
  query?: string;
  /** The features on for the workspace: a view turned off is left out (D126). */
  on: ReadonlySet<Feature>;
}) {
  const views = VIEWS.filter((v) => !v.feature || on.has(v.feature));
  return (
    // From 1280 the sidebar lists these views and "See what members see" (D122), so this copy is hidden.
    <nav aria-label={t["calendar.nav.aria"]} className="mt-3 xl:hidden">
      <ul
        className="grid border border-plum"
        style={{ gridTemplateColumns: `repeat(${views.length}, minmax(0, 1fr))` }}
      >
        {views.map((v) => (
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
      {on.has("board") && (
        <p className="text-right">
          <a
            href={`/w/${slug}/board`}
            className="inline-flex min-h-11 items-center text-body-sm font-semibold text-plum underline underline-offset-4"
          >
            {t["board.seeMembers"]}
          </a>
        </p>
      )}
    </nav>
  );
}
