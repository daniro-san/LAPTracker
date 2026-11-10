// Frame for every /admin page: the site's own header, lace and footer like every other page (07c S3c),
// the admin nav under the header with the live candle, and the PIN card until the session cookie exists.
// The header has no event selector here: admin pages are not about one event. RunWatch, the area's one
// poller (#91), wraps the page so the candle is current on every admin page.
import Link from "next/link";
import type { ReactNode } from "react";

import { requestServerClock } from "@/app/_ui/locale";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { isAdmin } from "@/lib/admin-session";
import { copy } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { listRuns, runningSnapshots } from "@/lib/queries/admin";

import { LiveIndicator } from "./parts";
import { PinGate } from "./PinGate";
import { RunWatch } from "./RunWatch";
import { watchViews } from "./words";

const NAV = [
  { href: "/admin", label: copy.admin.nav.overview },
  { href: "/admin/runs", label: copy.admin.nav.runs },
  { href: "/admin/errors", label: copy.admin.nav.errors },
];

export async function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const [unlocked, clock] = await Promise.all([isAdmin(), requestServerClock()]);
  return (
    // English whatever the viewer's language (D48): the lang attribute says so for this subtree.
    <div lang="en">
      <SiteHeader events={[]} currentId={null} homeId={null} copy={copy} publicPage={false} />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        {unlocked ? <Unlocked title={title}>{children}</Unlocked> : <PinGate />}
      </main>
      <SiteFooter clock={clock} copy={copy} />
    </div>
  );
}

async function Unlocked({ title, children }: { title: string; children: ReactNode }) {
  const now = new Date();
  const [[running, [last]], clock] = await Promise.all([
    withPageDb((db) => Promise.all([runningSnapshots(db, now), listRuns(db, 1)])),
    requestServerClock(),
  ]);
  const views = watchViews(running, last, clock);
  return (
    <RunWatch running={views.running} latest={views.latest}>
      <nav
        aria-label={copy.admin.nav.label}
        className="mb-3 flex flex-wrap items-center gap-x-1 border-b border-rule"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex min-h-11 items-center px-3 text-sm font-medium text-plum hover:underline"
          >
            {n.label}
          </Link>
        ))}
        <LiveIndicator on={running.length > 0} />
      </nav>
      <h1 className="mb-3 font-display text-display-lg">{title}</h1>
      {children}
    </RunWatch>
  );
}
