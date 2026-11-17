// `/alliances/merge[?a=<union_id>&b=<union_id>]`: the merge simulator (D84, issue 282). Two tracked
// alliances as one, against the member cap: members, might and rank with everyone and within the cap.
// A GET form, no client-side fetch. Alliance totals only, labelled a simulation; public. A union id that is
// not a number, or is not among the tracked alliances with a usable roster, is a 404; a missing one is
// not (the picker waits for it). Behind the `merge-simulator` flag (D91): off, the page is a 404.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { EmptyState } from "@/app/_ui/EmptyState";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { FLOW_PATH } from "@/app/_ui/FlowPicker";
import { requestClock, requestCopy } from "@/app/_ui/locale";
import { MergePicker } from "@/app/_ui/MergePicker";
import { MergeResultView } from "@/app/_ui/MergeSimulator";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { TextLink } from "@/lib/brand/components/TextLink";
import { getEnv } from "@/lib/env";
import { isOn } from "@/lib/flags";
import { withPageDb } from "@/lib/page";
import { homeEvent, listEvents, mergePage } from "@/lib/queries";

type Search = Promise<Record<string, string | string[] | undefined>>;

/** A missing (or empty) parameter is null; one that is not an id is `undefined` (a 404). */
const idOf = (raw: string | string[] | undefined) => {
  if (raw === undefined || raw === "") return null;
  return typeof raw === "string" && /^\d{1,15}$/.test(raw) ? Number(raw) : undefined;
};

const load = cache((a: number | null, b: number | null) =>
  withPageDb(async (db) => {
    // One read of the event list, shared by the header and the turnout figures. The war turnout line is
    // read and shown only under its own flag (D91), which is read while the rosters are.
    const eventsRead = listEvents(db);
    const turnout = isOn("war-turnout");
    const [page, events] = await Promise.all([
      mergePage(db, a !== null && b !== null ? [a, b] : null, undefined, eventsRead, turnout),
      eventsRead,
    ]);
    return {
      page,
      events,
      homeId: homeEvent(events, new Date(), getEnv().SNAPSHOT_WINDOW_MIN)?.id ?? null,
      turnout: await turnout,
    };
  }),
);

/** The page's data, or null when a chosen id is malformed or not a tracked alliance with a roster. */
async function read(searchParams: Search) {
  const sp = await searchParams;
  const [a, b] = [idOf(sp.a), idOf(sp.b)];
  if (a === undefined || b === undefined) return null;
  const data = await load(a, b);
  const known = (id: number | null) =>
    id === null || data.page.alliances.some((c) => c.unionId === id);
  return known(a) && known(b) ? { ...data, a, b } : null;
}

export async function generateMetadata(): Promise<Metadata> {
  if (!(await isOn("merge-simulator"))) notFound();
  const copy = await requestCopy();
  return { title: `${copy.merge.title} · ${copy.site.name}` };
}

export default async function MergePage({ searchParams }: { searchParams: Search }) {
  if (!(await isOn("merge-simulator"))) notFound();
  const data = await read(searchParams);
  if (!data) notFound();
  const [clock, copy] = await Promise.all([requestClock(), requestCopy()]);
  const { page, events, homeId, a, b, turnout } = data;
  const m = copy.merge;
  return (
    <>
      <SiteHeader events={events} currentId={null} homeId={homeId} clock={clock} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Breadcrumbs
          crumbs={[
            { key: "ledger", href: "/", label: copy.site.home },
            { key: "merge", label: m.title },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
            {m.title}
          </h1>
          <ExactToggle />
        </div>
        <p className="mb-1 mt-1 inline-block border border-rule px-2 py-0.5 text-sm font-medium text-plum">
          {m.tag}
        </p>
        <p className="mt-1 text-body-sm text-ink/70">{m.lead}</p>
        <p className="mb-2">
          <TextLink
            href={FLOW_PATH}
            className="inline-flex min-h-11 items-center text-sm font-medium"
          >
            {copy.flow.title} <span aria-hidden="true">&nbsp;→</span>
          </TextLink>
        </p>
        <MergePicker choices={page.alliances} a={a} b={b} copy={copy} />
        {page.merge ? (
          <MergeResultView merge={page.merge} turnout={turnout} clock={clock} copy={copy} />
        ) : (
          <EmptyState>{a !== null && a === b ? m.same : m.pick}</EmptyState>
        )}
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
