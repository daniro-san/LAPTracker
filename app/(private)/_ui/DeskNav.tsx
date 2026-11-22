// The desk's five destinations (D71) for each width (D122): the bottom tabs below 768, the side rail from
// 768 and the labelled sidebar with each destination's views from 1280. Frame puts them in AppShell. A
// destination or view the site's owner turned off for the alliance is left out (D126).
import type { NavItem } from "@/lib/brand/components/layout/layout-rules";
import { NavRail } from "@/lib/brand/components/layout/NavRail";
import { NavSidebar } from "@/lib/brand/components/layout/NavSidebar";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { fill } from "@/lib/words";
import type { Feature } from "@/lib/workspace-features";

import { TabIcon, type TabId } from "./TabIcon";

const TABS: TabId[] = ["home", "members", "mark", "days", "review"];
/** The tabs that exist so far; the others come with their own issues and are shown as "soon". Notices
 * live inside Calendar (its Week · Caravans · Notices views, prototype v5), so it has no tab of its own. */
const PATHS: Partial<Record<TabId, string>> = {
  home: "",
  members: "/members",
  mark: "/roll-call",
  days: "/calendar",
  review: "/follow-up",
};

/** The switch each destination or view belongs to (D126); the others are always there. */
const FEATURE_OF: Partial<Record<TabId | DeskView, Feature>> = {
  mark: "roll_call",
  review: "follow_up",
  insights: "insights",
  caravans: "caravans",
  notices: "notices",
  thefts: "thefts",
};
const shown = (on: ReadonlySet<Feature>) => (id: TabId | DeskView) => {
  const feature = FEATURE_OF[id];
  return !feature || on.has(feature);
};

/** The Home tab's count: screenshot drafts (issue 299) and notice reviews for this officer (D113). Over the
 * icon on the tabs and the rail; at the end of the row on the sidebar (`inline`). */
function Waiting({
  n,
  t,
  inline = false,
}: {
  n: number;
  t: WorkspaceDictionary;
  inline?: boolean;
}) {
  if (n === 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className={`${inline ? "ml-auto" : "absolute top-1 left-1/2 ml-2"} rounded-full bg-seal px-1.5 text-[11px] leading-4 font-semibold text-paper tabular-nums`}
      >
        {n}
      </span>
      <span className="sr-only">{`, ${fill(t["shots.badge"], { n })}`}</span>
    </>
  );
}

/** A view of a destination, open on this page (the sidebar marks it, D122), and its destination. */
export type DeskView = "former" | "insights" | "caravans" | "notices" | "thefts";
export const VIEW_TAB: Record<DeskView, TabId> = {
  former: "members",
  insights: "members",
  caravans: "days",
  notices: "days",
  thefts: "days",
};

/** The destinations for the rail and the sidebar, with the sidebar's views. */
function navItems(
  t: WorkspaceDictionary,
  slug: string,
  on: ReadonlySet<Feature>,
): NavItem<TabId>[] {
  const base = `/w/${slug}`;
  const views: Partial<Record<TabId, NavItem["views"]>> = {
    members: (
      [
        { id: "former", label: t["members.view.former"], href: `${base}/members?view=former` },
        { id: "insights", label: t["members.view.insights"], href: `${base}/insights` },
      ] as const
    ).filter((v) => shown(on)(v.id)),
    days: (
      [
        { id: "caravans", label: t["calendar.nav.caravans"], href: `${base}/calendar/caravans` },
        { id: "notices", label: t["calendar.nav.notices"], href: `${base}/notices` },
        { id: "thefts", label: t["thefts.nav"], href: `${base}/thefts` },
      ] as const
    ).filter((v) => shown(on)(v.id)),
  };
  return TABS.filter(shown(on)).map((id) => {
    const path = PATHS[id];
    return {
      id,
      label: t[`tab.${id}`],
      ...(path !== undefined && { href: `${base}${path}` }),
      ...(views[id] && { views: views[id] }),
    };
  });
}

export function SideNav({
  t,
  slug,
  current,
  view,
  waiting,
  wide,
  on,
}: {
  t: WorkspaceDictionary;
  slug: string;
  current: TabId | null;
  view?: DeskView;
  waiting: number;
  wide: boolean;
  /** The features on for this workspace (D126). */
  on: ReadonlySet<Feature>;
}) {
  const props = {
    label: t["tab.aria"],
    items: navItems(t, slug, on),
    current,
    icons: Object.fromEntries(TABS.map((id) => [id, <TabIcon key={id} id={id} />])),
    soon: t["tab.soon"],
  };
  if (!wide) return <NavRail {...props} badges={{ home: <Waiting n={waiting} t={t} /> }} />;
  return (
    <NavSidebar
      {...props}
      {...(view && { view })}
      badges={{ home: <Waiting n={waiting} t={t} inline /> }}
      footer={
        on.has("board") && (
          <a href={`/w/${slug}/board`} className="text-link inline-flex min-h-11 items-center">
            {t["board.seeMembers"]}
          </a>
        )
      }
    />
  );
}

export function Tabs({
  t,
  slug,
  current,
  waiting,
  on,
}: {
  t: WorkspaceDictionary;
  slug: string;
  current: TabId | null;
  waiting: number;
  on: ReadonlySet<Feature>;
}) {
  const tabs = TABS.filter(shown(on));
  return (
    // Hidden while a notice editor is open, so its save bar is never under the tabs (review of PR 344).
    <nav
      aria-label={t["tab.aria"]}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-paper pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] [:root:has(form[data-notice-editor])_&]:hidden"
    >
      <ul
        className="mx-auto grid max-w-[640px]"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(min-content, 1fr))` }}
      >
        {tabs.map((id) => {
          const label = t[`tab.${id}`];
          const inside = (
            <>
              <TabIcon id={id} />
              {/* Five tabs leave 72 px each at 360 px. 12 px fits the longest word ("Acompanhar", 66 px) whole;
                  a tab is never narrower than its longest word (min-content, issue 585: it was cut at
                  320 px), and a label of two words may take two lines, broken only between words. */}
              <span className="max-w-full text-[12px] leading-tight hyphens-none [overflow-wrap:normal]">
                {label}
              </span>
              {id === "home" && <Waiting n={waiting} t={t} />}
            </>
          );
          const box =
            "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-center";
          const path = PATHS[id];
          return (
            <li key={id}>
              {path === undefined ? (
                <span
                  aria-disabled="true"
                  aria-label={`${label} (${t["tab.soon"]})`}
                  className={`${box} border-t-[3px] border-transparent text-ink/70`}
                >
                  {inside}
                  <span aria-hidden="true" className="text-[11px] leading-none">
                    {t["tab.soon"].toLowerCase()}
                  </span>
                </span>
              ) : (
                <a
                  href={`/w/${slug}${path}`}
                  aria-current={id === current ? "page" : undefined}
                  className={`${box} border-t-[3px] ${
                    id === current ? "border-plum font-semibold text-plum" : "border-transparent"
                  }`}
                >
                  {inside}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
