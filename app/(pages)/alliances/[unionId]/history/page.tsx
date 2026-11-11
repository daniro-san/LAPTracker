// `/alliances/[unionId]/history[?show=joined|left|renamed|kills][&before=<ISO time>]`: member history
// (D60, issue 197). One card per stored roster (daily reads and public event snapshots), newest first, 14
// a page; every card starts closed and loads its contents when opened. With a filter on, every card is
// diffed here to know which match. No event in the URL: the
// history belongs to none, so the header's selector reads "All events".
// A union id with no usable roster is a 404.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { EmptyState } from "@/app/_ui/EmptyState";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { allianceLabel } from "@/app/_ui/format";
import { requestClock, requestCopy } from "@/app/_ui/locale";
import { HISTORY_FILTERS, matchesFilter, type HistoryFilter } from "@/app/_ui/member-history";
import { HistoryCardView } from "@/app/_ui/MemberHistory";
import { AllianceBadge } from "@/app/_ui/Pictures";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { TextLink } from "@/lib/brand/components/TextLink";
import type { Dictionary } from "@/lib/copy";
import type { Db } from "@/lib/db";
import { withPageDb } from "@/lib/page";
import { homeEvent, listEvents, memberHistory, memberHistoryIndex } from "@/lib/queries";

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
      entries: cards.map(({ at, event, since }) => ({ at, event, since })),
    };
  }
  return memberHistoryIndex(db, unionId, { before });
}

const load = cache((unionId: number, before: number | null, show: HistoryFilter | null) =>
  withPageDb(async (db) => {
    const [history, events] = await Promise.all([
      historyPage(db, unionId, before === null ? null : new Date(before), show),
      listEvents(db),
    ]);
    return history && { history, events, homeId: homeEvent(events)?.id ?? null };
  }),
);

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
  if (!data) return {};
  const copy = await requestCopy();
  const { tag, name, unionId } = data.history;
  const label = allianceLabel(tag ?? String(unionId), name);
  return { title: `${label} · ${copy.history.title} · ${copy.site.name}` };
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
  const [data, clock, copy] = await Promise.all([
    load(inputs.unionId, inputs.before, inputs.show),
    requestClock(),
    requestCopy(),
  ]);
  if (!data) notFound();
  const { history, events, homeId } = data;
  const { unionId, show } = { ...inputs, unionId: history.unionId };
  const label = allianceLabel(history.tag ?? String(unionId), history.name);
  return (
    <>
      <SiteHeader events={events} currentId={null} homeId={homeId} clock={clock} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Breadcrumbs
          crumbs={[
            { key: "ledger", href: "/", label: copy.site.home },
            ...(homeId === null
              ? []
              : [{ key: "alliance", href: `/events/${homeId}/alliances/${unionId}`, label }]),
            { key: "history", label: copy.history.title },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <AllianceBadge badgeId={history.badgeId} size="md" />
            <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
              {label}
            </h1>
          </div>
          <ExactToggle />
        </div>
        <p className="mb-3 mt-1 text-body-sm text-ink/70">{copy.history.lead}</p>
        <Filters unionId={unionId} show={show} copy={copy} />
        {history.entries.length === 0 ? (
          <EmptyState>{copy.history.none}</EmptyState>
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
