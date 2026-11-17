// `/alliances/flow[?from=YYYY-MM-DD&to=YYYY-MM-DD]`: member flow between the tracked alliances (D89, issue
// 275). Which alliance each member was in on two days with a usable daily read, counted per source and
// destination: counts only, no member names, moves under 5 members hidden. A GET form, no client-side
// fetch; public. A day that is not a date, or is not one with a usable read, is a 404, and so is a link that
// gives only one of the two days.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { EmptyState } from "@/app/_ui/EmptyState";
import { FlowPicker } from "@/app/_ui/FlowPicker";
import { FlowView } from "@/app/_ui/FlowView";
import { dayDate } from "@/app/_ui/format";
import { requestClock, requestCopy } from "@/app/_ui/locale";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { withPageDb } from "@/lib/page";
import { flowPage, homeEvent, listEvents } from "@/lib/queries";

type Search = Promise<Record<string, string | string[] | undefined>>;

/** A missing (or empty) parameter is null; one that is not a calendar date is `undefined` (a 404): an
 * impossible date such as 2026-02-31 would reach the database's date column. */
const dayOf = (raw: string | string[] | undefined) => {
  if (raw === undefined || raw === "") return null;
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const at = dayDate(raw);
  return !Number.isNaN(at.getTime()) && at.toISOString().startsWith(raw) ? raw : undefined;
};

const load = cache((from: string | null, to: string | null) =>
  withPageDb(async (db) => {
    const [page, events] = await Promise.all([
      flowPage(db, new Date(), from !== null && to !== null ? { from, to } : null),
      listEvents(db),
    ]);
    return { page, events, homeId: homeEvent(events)?.id ?? null };
  }),
);

/** The page's data, or null when a chosen day is malformed or has no usable read. */
async function read(searchParams: Search) {
  const sp = await searchParams;
  const [from, to] = [dayOf(sp.from), dayOf(sp.to)];
  if (from === undefined || to === undefined || (from === null) !== (to === null)) return null;
  const data = await load(from, to);
  const known = (day: string | null) => day === null || data.page.days.includes(day);
  return known(from) && known(to) ? data : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = await requestCopy();
  return { title: `${copy.flow.title} · ${copy.site.name}` };
}

export default async function FlowPage({ searchParams }: { searchParams: Search }) {
  const data = await read(searchParams);
  if (!data) notFound();
  const [clock, copy] = await Promise.all([requestClock(), requestCopy()]);
  const { page, events, homeId } = data;
  const f = copy.flow;
  const { period, flow } = page;
  return (
    <>
      <SiteHeader events={events} currentId={null} homeId={homeId} clock={clock} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Breadcrumbs
          crumbs={[
            { key: "ledger", href: "/", label: copy.site.home },
            { key: "flow", label: f.title },
          ]}
        />
        <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
          {f.title}
        </h1>
        <p className="mb-1 mt-1 inline-block border border-rule px-2 py-0.5 text-sm font-medium text-plum">
          {f.tag}
        </p>
        <p className="mb-3 mt-1 text-body-sm text-ink/70">{f.lead}</p>
        {period ? (
          <>
            <FlowPicker
              days={page.days}
              from={period.from}
              to={period.to}
              clock={clock}
              copy={copy}
            />
            {flow ? (
              <FlowView flow={flow} from={period.from} to={period.to} clock={clock} copy={copy} />
            ) : (
              <EmptyState>{f.order}</EmptyState>
            )}
          </>
        ) : (
          <EmptyState>{f.none}</EmptyState>
        )}
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
