// `/alliances/[unionId]/history[?show=joined|left|renamed|kills][&before=<ISO time>]`: member history
// (D60, issue 197). One card per stored roster (daily reads and public event snapshots), newest first, 14
// a page; every card starts closed and loads its contents when opened. With a filter on, every card is
// diffed here to know which match. No event in the URL: the
// history belongs to none, so the header's selector reads "All events".
// D133: it is also the page of an alliance outside the home event: its ranks board line, and for one the daily
// read does not cover, "Get today's details" and its statement. A union id with no usable roster and on no
// ranks board is a 404.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AllianceHead } from "@/app/_ui/AllianceHead";
import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { EmptyState } from "@/app/_ui/EmptyState";
import { allianceLabel } from "@/app/_ui/format";
import { notFoundTitle, requestClock, requestCopy, requestLocale } from "@/app/_ui/locale";
import { HISTORY_FILTERS, matchesFilter, type HistoryFilter } from "@/app/_ui/member-history";
import { HistoryCardView } from "@/app/_ui/MemberHistory";
import { previewImage } from "@/app/_ui/preview";
import { sharedEventAllianceIds, sharedEvents, sharedRead } from "@/app/_ui/public-reads";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { TextLink } from "@/lib/brand/components/TextLink";
import type { Dictionary } from "@/lib/copy";
import { DataUnavailableError } from "@/lib/data-unavailable";
import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { allianceStatement, homeEvent, memberHistory, memberHistoryIndex } from "@/lib/queries";
import { allianceOnBoard, detailsState, type BoardAlliance } from "@/lib/queries/alliance-list";
import { countsOf } from "@/lib/queries/member-history";

type Params = Promise<{ unionId: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/** The cards' heads. Unfiltered: the light index. Filtered: every card diffed, to keep those that match. */
async function historyPage(
  db: Db,
  unionId: number,
  before: Date | null,
  show: HistoryFilter | null,
) {
  if (show) {
    const full = await memberHistory(db, unionId, { before });
    if (!full) return null;
    const cards = full.cards.filter((c) => matchesFilter(c, show));
    const { tag, name, badgeId, older } = full;
    return {
      unionId,
      tag,
      name,
      badgeId,
      older,
      entries: cards.map((c) => ({
        at: c.at,
        event: c.event,
        since: c.since,
        counts: countsOf(c),
      })),
    };
  }
  return memberHistoryIndex(db, unionId, { before });
}

/** An alliance with no usable roster yet, named by its board row (D133). */
const noHistory = (unionId: number, b: BoardAlliance) => ({
  unionId,
  tag: b.tag,
  name: b.name,
  badgeId: b.badgeId,
  older: null,
  entries: [],
});

/** Null when the database cannot be reached (D143): the page is then served from the shared reads, and
 * "Get today's details" is not shown. */
const unlessDown = (error: unknown) => {
  if (error instanceof DataUnavailableError) return null;
  throw error;
};

/** "Get today's details" (null: unknown, the database is down) and the time of today's lookup. */
async function detailsOf(unionId: number, now: Date, env: ReturnType<typeof getEnv>) {
  const details = await withPageDb((db) => detailsState(db, unionId, now, env)).catch(unlessDown);
  return { details, lookup: details?.lookup?.at.getTime() ?? null };
}

/** Shared by the page and its <title> within one request. The history, the board line, the statement and the
 * event list are shared with every viewer until the next write (D143); "Get today's details" is read per view:
 * it depends on the clock, the day's claims and the workspaces' keys, which are never shared. */
const load = cache(async (unionId: number, before: number | null, show: HistoryFilter | null) => {
  const now = new Date();
  const env = getEnv();
  const read = async (db: Db) => {
    const [history, board] = await Promise.all([
      historyPage(db, unionId, before === null ? null : new Date(before), show),
      allianceOnBoard(db, unionId),
    ]);
    return history || board ? { history, board } : null;
  };
  // Keyed by today's lookup too: "Get today's details" refreshes the page as soon as its answer comes, which
  // on Vercel can be before the invalidation is applied (after the response).
  const { details, lookup } = await detailsOf(unionId, now, env);
  const [rows, events] = await Promise.all([
    // Only the first page is shared: an older page's `before` comes from the URL, so it would add an
    // entry per made-up time.
    before === null
      ? sharedRead("alliance-history", [unionId, show, lookup], read)
      : withPageDb(read),
    sharedEvents(),
  ]);
  if (!rows) return null;
  const { history, board } = rows;
  const homeId = homeEvent(events, now, env.SNAPSHOT_WINDOW_MIN)?.id ?? null;
  const [statement, homeIds] = await Promise.all([
    details?.daily
      ? null
      : sharedRead("statement", [unionId, lookup], (db) => allianceStatement(db, unionId)).catch(
          unlessDown,
        ),
    homeId === null ? ([] as number[]) : sharedEventAllianceIds(homeId),
  ]);
  return {
    history: history ?? (board && noHistory(unionId, board)),
    events,
    homeId,
    inHome: homeIds.includes(unionId),
    board,
    details,
    statement,
  };
});

/** The page's inputs, or null for a malformed id or cursor (a 404). */
async function inputsOf(params: Params, searchParams: Search) {
  const [{ unionId }, sp] = await Promise.all([params, searchParams]);
  if (!/^\d{1,15}$/.test(unionId)) return null;
  const rawBefore = typeof sp.before === "string" ? Date.parse(sp.before) : null;
  if (Number.isNaN(rawBefore)) return null;
  const show = HISTORY_FILTERS.find((f) => f === sp.show) ?? null;
  return { unionId: Number(unionId), before: rawBefore, show };
}

const href = (unionId: number, show: HistoryFilter | null, before: Date | null = null) => {
  const q = new URLSearchParams();
  if (show) q.set("show", show);
  if (before) q.set("before", before.toISOString());
  const query = q.toString();
  return `/alliances/${unionId}/history${query ? `?${query}` : ""}`;
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const inputs = await inputsOf(params, searchParams);
  const data = inputs && (await load(inputs.unionId, inputs.before, inputs.show));
  if (!data?.history) return notFoundTitle();
  const copy = await requestCopy();
  const { tag, name, unionId, badgeId } = data.history;
  const label = allianceLabel(tag ?? String(unionId), name);
  return {
    title: `${label} · ${copy.history.title} · ${copy.site.name}`,
    ...(badgeId != null && previewImage(`/img/badge/${badgeId}`, label)),
  };
}

function Filters({
  unionId,
  show,
  copy,
}: {
  unionId: number;
  show: HistoryFilter | null;
  copy: Dictionary;
}) {
  const words: Record<HistoryFilter, string> = {
    joined: copy.members.joined,
    left: copy.members.left,
    renamed: copy.history.renamed,
    kills: copy.ledger.kills,
  };
  const link = (key: HistoryFilter | null, label: string) => (
    <li key={key ?? "all"}>
      <Link
        href={href(unionId, key)}
        aria-current={show === key ? "page" : undefined}
        className="drawn-frame-soft tint-button inline-flex min-h-11 items-center px-3 text-sm font-medium text-plum aria-[current=page]:bg-plum/10"
      >
        {label}
      </Link>
    </li>
  );
  return (
    <nav aria-label={copy.history.show} className="mb-3">
      <ul className="flex flex-wrap gap-2">
        {link(null, copy.history.all)}
        {HISTORY_FILTERS.map((f) => link(f, words[f]))}
      </ul>
    </nav>
  );
}

/** Back to the newest page, and on to older rosters. */
function Pager({
  unionId,
  show,
  paged,
  older,
  copy,
}: {
  unionId: number;
  show: HistoryFilter | null;
  paged: boolean;
  older: Date | null;
  copy: Dictionary;
}) {
  return (
    <nav className="mt-4 flex flex-wrap justify-between gap-2">
      {paged && (
        <TextLink
          href={href(unionId, show)}
          className="inline-flex min-h-11 items-center px-2 text-sm font-medium"
        >
          <span aria-hidden="true">↑&nbsp;</span>
          {copy.history.newest}
        </TextLink>
      )}
      {older && (
        <TextLink
          href={href(unionId, show, older)}
          className="ml-auto inline-flex min-h-11 items-center px-2 text-sm font-medium"
        >
          {copy.history.older}
          <span aria-hidden="true">&nbsp;↓</span>
        </TextLink>
      )}
    </nav>
  );
}

export default async function MemberHistoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const inputs = await inputsOf(params, searchParams);
  if (!inputs) notFound();
  const [data, clock, copy, locale] = await Promise.all([
    load(inputs.unionId, inputs.before, inputs.show),
    requestClock(),
    requestCopy(),
    requestLocale(),
  ]);
  if (!data?.history) notFound();
  const { history, events, homeId, inHome } = data;
  const { unionId, show } = { ...inputs, unionId: history.unionId };
  const label = allianceLabel(history.tag ?? String(unionId), history.name);
  // Never read: the page says so plainly, with no filters to pick (D133).
  const none = history.entries.length === 0 && show === null && inputs.before === null;
  return (
    <>
      <SiteHeader events={events} currentId={null} homeId={homeId} clock={clock} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Breadcrumbs
          crumbs={[
            { key: "ledger", href: "/", label: copy.site.home },
            homeId !== null && inHome
              ? { key: "alliance", href: `/events/${homeId}/alliances/${unionId}`, label }
              : { key: "alliance", href: `/alliances/${unionId}`, label },
            { key: "history", label: copy.history.title },
          ]}
        />
        <AllianceHead
          unionId={unionId}
          label={label}
          badgeId={history.badgeId}
          board={data.board}
          details={data.details}
          statement={data.statement}
          clock={clock}
          locale={locale}
          copy={copy}
        />
        {!none && (
          <>
            <p className="mb-3 mt-1 text-body-sm text-ink/70">{copy.history.lead}</p>
            <Filters unionId={unionId} show={show} copy={copy} />
          </>
        )}
        {history.entries.length === 0 ? (
          <EmptyState>{none ? copy.alliances.noRoster : copy.history.none}</EmptyState>
        ) : (
          <ul>
            {history.entries.map((e) => (
              <HistoryCardView
                key={e.at.toISOString()}
                unionId={unionId}
                entry={e}
                filter={show}
                clock={clock}
                copy={copy}
              />
            ))}
          </ul>
        )}
        <Pager
          unionId={unionId}
          show={show}
          paged={inputs.before !== null}
          older={history.older}
          copy={copy}
        />
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
