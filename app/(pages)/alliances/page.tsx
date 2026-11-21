// `/alliances[?page=n]`: every alliance on the server's ranks board (D133, issue 459). The day's tracked set
// first (read every day: members, history, events), then the rest of the board by might, MORE_PER_PAGE a page.
// The board's numbers only: might and kills as the game's board shows them, and each alliance's place.
import type { Metadata } from "next";
import Link from "next/link";

import { allianceHref, AllianceRows } from "@/app/_ui/AllianceRows";
import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { EmptyState } from "@/app/_ui/EmptyState";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { dayDate } from "@/app/_ui/format";
import { requestClock, requestCopy } from "@/app/_ui/locale";
import { sharedAllianceList, sharedEventAllianceIds, sharedEvents } from "@/app/_ui/public-reads";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { TRACKED_COUNT } from "@/config/alliances";
import { fill, type Dictionary } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { homeEvent } from "@/lib/queries";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const copy = await requestCopy();
  return {
    title: `${copy.alliances.title} · ${copy.site.name}`,
    description: copy.alliances.description,
  };
}

const PAGER = "inline-flex min-h-11 items-center px-3 text-sm font-medium text-plum";

/** "← Previous · Page 2 of 4 · Next →": links, so it works without script and can be shared. */
function Pager({ page, pages, copy }: { page: number; pages: number; copy: Dictionary }) {
  if (pages <= 1) return null;
  const to = (n: number) => (n === 1 ? "/alliances#more" : `/alliances?page=${n}#more`);
  return (
    <nav aria-label={copy.alliances.more} className="mt-2 flex items-center justify-between gap-2">
      {page > 1 ? (
        <Link href={to(page - 1)} className={`drawn-frame-soft tint-button ${PAGER}`}>
          <span aria-hidden="true">←&nbsp;</span>
          {copy.alliances.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm tabular-nums text-ink/70">
        {fill(copy.alliances.page, { page, pages })}
      </span>
      {page < pages ? (
        <Link href={to(page + 1)} className={`drawn-frame-soft tint-button ${PAGER}`}>
          {copy.alliances.next}
          <span aria-hidden="true">&nbsp;→</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export default async function AlliancesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const asked = typeof sp.page === "string" && /^\d{1,4}$/.test(sp.page) ? Number(sp.page) : 1;
  const [clock, copy] = await Promise.all([requestClock(), requestCopy()]);
  const [events, list] = await Promise.all([sharedEvents(), sharedAllianceList(asked)]);
  const homeId = homeEvent(events, new Date(), getEnv().SNAPSHOT_WINDOW_MIN)?.id ?? null;
  const inHome = new Set(homeId === null ? [] : await sharedEventAllianceIds(homeId));
  const href = (unionId: number) => allianceHref(unionId, inHome, homeId);
  const a = copy.alliances;
  return (
    <>
      <SiteHeader events={events} currentId={null} homeId={homeId} clock={clock} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Breadcrumbs
          crumbs={[
            { key: "ledger", href: "/", label: copy.site.home },
            { key: "alliances", label: a.title },
          ]}
        />
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
            {a.title}
          </h1>
          <ExactToggle />
        </div>
        {!list.day ? (
          <EmptyState>{a.none}</EmptyState>
        ) : (
          <>
            <p className="mt-1 max-w-[65ch]">{fill(a.lead, { n: TRACKED_COUNT })}</p>
            <p className="text-body-sm text-ink/70">
              {fill(a.asOf, { date: clock.day(dayDate(list.day)) })}
            </p>
            {list.page === 1 && (
              <section aria-labelledby="tracked-h" className="mt-6">
                <h2 id="tracked-h" className="mb-2 font-subhead text-display-md">
                  {a.tracked}{" "}
                  <span className="text-ink/60 tabular-nums">({list.tracked.length})</span>
                </h2>
                <AllianceRows rows={list.tracked} href={href} copy={copy} />
              </section>
            )}
            {list.more.length > 0 && (
              <section aria-labelledby="more-h" id="more" className="mt-8 scroll-mt-20">
                <h2 id="more-h" className="font-subhead text-display-md">
                  {a.more}{" "}
                  <span className="text-ink/60 tabular-nums">
                    ({list.total - list.tracked.length})
                  </span>
                </h2>
                <p className="mb-2 text-body-sm text-ink/70">{a.moreNote}</p>
                <AllianceRows rows={list.more} href={href} copy={copy} />
                <Pager page={list.page} pages={list.pages} copy={copy} />
              </section>
            )}
          </>
        )}
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
