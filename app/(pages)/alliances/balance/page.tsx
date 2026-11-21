// `/alliances/balance[?a=<union ids>&b=<union ids>]`: the server's might shared out between the tracked
// alliances, a hypothetical bloc builder and the top 3's share over time (D85, issue 283). Alliance-level
// arithmetic from the daily reads (D60): no member is read or named. The builder starts empty, so a shared
// link never reads as an announcement; a link with blocs is kept out of search engines. Unknown or repeated
// ids in the URL are dropped; an alliance named in both blocs stays in A.
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlocCards, StackedBar } from "@/app/_ui/BalanceBar";
import { BalanceRows, BalanceTrend } from "@/app/_ui/BalanceRows";
import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { EmptyState } from "@/app/_ui/EmptyState";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { shareText } from "@/app/_ui/format";
import { requestClock, requestCopy, requestLocale } from "@/app/_ui/locale";
import { sharedEvents } from "@/app/_ui/public-reads";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { greatestShareUp, parseBlocs, TOP_N, topShare } from "@/lib/balance";
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { isOn } from "@/lib/flags";
import { withPageDb } from "@/lib/page";
import { homeEvent, powerBalance } from "@/lib/queries";

type Search = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Search;
}): Promise<Metadata> {
  const [sp, copy] = await Promise.all([searchParams, requestCopy()]);
  if (!(await isOn("server-balance"))) notFound();
  return {
    title: `${copy.balance.title} · ${copy.site.name}`,
    description: copy.balance.description,
    ...(sp.a || sp.b ? { robots: { index: false } } : {}),
  };
}

export default async function BalancePage({ searchParams }: { searchParams: Search }) {
  if (!(await isOn("server-balance"))) notFound();
  const [sp, clock, copy, locale] = await Promise.all([
    searchParams,
    requestClock(),
    requestCopy(),
    requestLocale(),
  ]);
  const [events, balance] = await withPageDb((db) =>
    Promise.all([sharedEvents(), powerBalance(db, new Date())]),
  );
  const { alliances, trend } = balance;
  const homeId = homeEvent(events, new Date(), getEnv().SNAPSHOT_WINDOW_MIN)?.id ?? null;
  const known = new Set(alliances.map((a) => a.unionId));
  const blocs = parseBlocs(first(sp.a), first(sp.b), known);
  const total = alliances.reduce((a, r) => a + r.might, 0);
  const b = copy.balance;
  // Only with a read: the newest of no reads is no date (and `Intl` refuses an Invalid Date).
  const newest =
    alliances.length > 0 ? new Date(Math.max(...alliances.map((a) => a.at.getTime()))) : null;
  // A date that ends in a full stop (German "30. Okt.") must not double the sentence's.
  const basis =
    newest && fill(b.basis, { n: alliances.length, date: clock.day(newest) }).replace(/\.\.$/, ".");
  return (
    <>
      <SiteHeader events={events} currentId={null} homeId={homeId} clock={clock} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Breadcrumbs
          crumbs={[
            { key: "ledger", href: "/", label: copy.site.home },
            { key: "balance", label: b.title },
          ]}
        />
        {!newest || total <= 0 ? (
          <EmptyState>{b.none}</EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
                {b.title}
              </h1>
              <ExactToggle />
            </div>
            <p className="mt-1 text-lg">
              {fill(b.lead, {
                max: shareText(greatestShareUp(alliances.map((a) => a.might)), locale),
                n: TOP_N,
                top: shareText(topShare(alliances.map((a) => a.might)), locale),
              })}
            </p>
            <p className="text-body-sm text-ink/70">
              {b.includes} {basis}
            </p>
            <StackedBar
              alliances={alliances}
              blocs={blocs}
              total={total}
              locale={locale}
              copy={copy}
            />
            <BlocCards alliances={alliances} blocs={blocs} locale={locale} copy={copy} />
            <BalanceRows
              alliances={alliances}
              blocs={blocs}
              total={total}
              newest={newest}
              locale={locale}
              clock={clock}
              copy={copy}
            />
            <BalanceTrend trend={trend} locale={locale} clock={clock} copy={copy} />
          </>
        )}
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
