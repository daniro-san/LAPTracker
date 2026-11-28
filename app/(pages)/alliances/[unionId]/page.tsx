// `/alliances/[unionId][?range=7d|30d|90d][&tab=moves[&show=joined|left]]`: one alliance's public page (issue
// 822). The head (server, leader, might, members of capacity, server rank), the statement and joining card
// (D128), the growth card and the member list with each member's public figures (D76 amendment 2026-11-28),
// or its joins and leaves of the last 30 days (issue 823); History is the member history's page (D60). An alliance outside the daily read also gets "Get today's details" (D133). A union id with no
// usable roster and on no ranks board is a 404.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AllianceDetails } from "@/app/_ui/AllianceDetails";
import { AllianceMembers, AllianceTabs, allianceFacts } from "@/app/_ui/AllianceDossier";
import {
  AllianceMovesView,
  moveFilterOf,
  netOf,
  signed,
  type MoveFilter,
} from "@/app/_ui/AllianceMoves";
import { detailsView } from "@/app/_ui/AllianceRows";
import { AllianceStatementCard } from "@/app/_ui/AllianceStatement";
import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { DossierHead } from "@/app/_ui/DossierHead";
import { EmptyState } from "@/app/_ui/EmptyState";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { allianceLabel, compact, type Clock } from "@/app/_ui/format";
import { rangeOf } from "@/app/_ui/growth";
import { GrowthCard, type GrowthSeries } from "@/app/_ui/GrowthCard";
import { notFoundTitle, requestClock, requestCopy, requestLocale } from "@/app/_ui/locale";
import { AllianceBadge } from "@/app/_ui/Pictures";
import { cardPreview } from "@/app/_ui/preview";
import { sharedEvents, sharedRead } from "@/app/_ui/public-reads";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import type { Dictionary } from "@/lib/copy";
import { DataUnavailableError } from "@/lib/data-unavailable";
import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import {
  allianceMoves,
  alliancePage,
  allianceStatement,
  homeEvent,
  NO_MOVES,
  type GrowthPoint,
} from "@/lib/queries";
import { allianceOnBoard, detailsState, type DetailsState } from "@/lib/queries/alliance-list";
import { serverDay } from "@/lib/schedule";

type Params = Promise<{ unionId: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/** Null when the database cannot be reached (D143): the page is then served from the shared reads. */
const unlessDown = (error: unknown) => {
  if (error instanceof DataUnavailableError) return null;
  throw error;
};

/** Shared by the page and its <title> within one request. The page's rows, the board line and the statement
 * are shared with every viewer until the next write (D143); "Get today's details" is read per view, and the
 * shared reads are keyed by today's lookup so its answer shows at once (as the history page). */
const load = cache(async (unionId: number) => {
  const now = new Date();
  const env = getEnv();
  const details = await withPageDb((db) => detailsState(db, unionId, now, env)).catch(unlessDown);
  const lookup = details?.lookup?.at.getTime() ?? null;
  const read = async (db: Db) => {
    const [page, board] = await Promise.all([
      alliancePage(db, unionId),
      allianceOnBoard(db, unionId),
    ]);
    return page || board ? { page, board } : null;
  };
  // Joins and leaves are keyed by the server day too: a new day drops the window that went stale. Null (no
  // usable roster in the window, an unknown id among them) is never cached.
  const today = serverDay(now, env);
  const [rows, events, statement, moves] = await Promise.all([
    sharedRead("alliance-page", [unionId, lookup], read),
    sharedEvents(),
    sharedRead("statement", [unionId, lookup], (db) => allianceStatement(db, unionId)).catch(
      unlessDown,
    ),
    sharedRead("alliance-moves", [unionId, today, lookup], (db) =>
      allianceMoves(db, unionId, today),
    ),
  ]);
  if (!rows) return null;
  const homeId = homeEvent(events, now, env.SNAPSHOT_WINDOW_MIN)?.id ?? null;
  return { ...rows, events, homeId, details, statement, moves: moves ?? NO_MOVES };
});

const unionIdOf = async (params: Params) => {
  const { unionId } = await params;
  return /^\d{1,15}$/.test(unionId) ? Number(unionId) : null;
};

/** The label from the newest roster, else the board's row. */
const labelOf = (data: NonNullable<Awaited<ReturnType<typeof load>>>, unionId: number) => {
  const named = data.page ?? data.board;
  return {
    label: allianceLabel(named?.tag ?? String(unionId), named?.name ?? null),
    badgeId: named?.badgeId ?? null,
  };
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const unionId = await unionIdOf(params);
  const data = unionId === null ? null : await load(unionId);
  if (!data || unionId === null) return notFoundTitle();
  const copy = await requestCopy();
  const { label } = labelOf(data, unionId);
  const title = `${label} · ${copy.site.name}`;
  return { title, ...cardPreview(`/img/card/alliance/${unionId}`, title, label) };
}

/** Might and members, one point per daily read, on one time axis. */
const growthSeries = (growth: GrowthPoint[], locale: string, copy: Dictionary): GrowthSeries[] => [
  {
    key: "might",
    label: copy.ledger.might,
    points: growth.map((g) => ({ day: g.day, value: g.might })),
    format: (n) => compact(n, locale),
  },
  {
    key: "members",
    label: copy.ledger.members,
    points: growth.map((g) => ({ day: g.day, value: g.members })),
    format: (n) => String(n),
  },
];

type Tab = "members" | "moves";

const tabOf = (v: unknown): Tab => (v === "moves" ? "moves" : "members");

/** The page's link with this range, tab and filter; the tab's and the filter's defaults are left out. */
function pageHref(unionId: number, range: number, tab: Tab, filter: MoveFilter) {
  const q = new URLSearchParams({ range: `${range}d` });
  if (tab === "moves") q.set("tab", tab);
  if (tab === "moves" && filter !== "all") q.set("show", filter);
  return `/alliances/${unionId}?${q}`;
}

/** The daily read's line, or "Get today's details" for an alliance outside it (D133). */
function Details({
  details,
  unionId,
  clock,
  copy,
}: {
  details: DetailsState | null;
  unionId: number;
  clock: Clock;
  copy: Dictionary;
}) {
  if (!details) return null;
  if (details.daily)
    return <p className="mt-1 text-body-sm text-ink/70">{copy.alliances.tracked}</p>;
  const view = detailsView(details, clock);
  return view && <AllianceDetails unionId={unionId} view={view} />;
}

export default async function AlliancePublicPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const unionId = await unionIdOf(params);
  if (unionId === null) notFound();
  const [data, clock, copy, locale, sp] = await Promise.all([
    load(unionId),
    requestClock(),
    requestCopy(),
    requestLocale(),
    searchParams,
  ]);
  if (!data) notFound();
  const { page, board, events, homeId } = data;
  const { label, badgeId } = labelOf(data, unionId);
  const growth = page?.growth ?? [];
  const [tab, range, filter] = [tabOf(sp.tab), rangeOf(sp.range), moveFilterOf(sp.show)];
  return (
    <>
      <SiteHeader events={events} currentId={null} homeId={homeId} clock={clock} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Breadcrumbs
          crumbs={[
            { key: "ledger", href: "/", label: copy.site.home },
            { key: "alliances", href: "/alliances", label: copy.alliances.title },
            { key: "alliance", label },
          ]}
        />
        <DossierHead
          picture={<AllianceBadge badgeId={badgeId} size="md" />}
          title={label}
          actions={<ExactToggle />}
          facts={allianceFacts(page, board, clock, locale, copy)}
        />
        <Details details={data.details} unionId={unionId} clock={clock} copy={copy} />
        <AllianceStatementCard
          statement={data.statement}
          clock={clock}
          locale={locale}
          copy={copy}
        />
        {growth.length > 0 && (
          <GrowthCard
            series={growthSeries(growth, locale, copy)}
            range={range}
            hrefOf={(r) => pageHref(unionId, r, tab, filter)}
            clock={clock}
            copy={copy}
          />
        )}
        <AllianceTabs
          unionId={unionId}
          members={page?.roster.length ?? 0}
          net={signed(netOf(data.moves.week))}
          current={tab}
          copy={copy}
        />
        {tab === "moves" ? (
          <AllianceMovesView
            data={data.moves}
            filter={filter}
            hrefOf={(f) => pageHref(unionId, range, "moves", f)}
            clock={clock}
            copy={copy}
          />
        ) : page ? (
          <AllianceMembers page={page} clock={clock} copy={copy} />
        ) : (
          <EmptyState>{copy.alliances.noRoster}</EmptyState>
        )}
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
