// Frame for every /admin page: the site's own header, lace and footer like every other page (07c S3c),
// the admin nav under the header with the live candle, and the PIN card until the session cookie exists.
// The header has no event selector here: admin pages are not about one event. RunWatch, the area's one
// poller (#91), wraps the page so the candle is current on every admin page. Each page checks
// isAdmin() itself before it reads the database (issue 218) and, when locked, renders this shell with
// no children: the PIN card.
import type { ReactNode } from "react";

import { requestServerClock } from "@/app/_ui/locale";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { adminSession } from "@/lib/admin-session";
import { TextLink } from "@/lib/brand/components/TextLink";
import { copy } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import { hasPendingRehearsal, listRuns, runningSnapshots } from "@/lib/queries/admin";
import { listDailyReads } from "@/lib/queries/daily-runs";
import { pollFrom } from "@/lib/tick-gate";

import { LogoutButton, PinGate } from "./PinGate";
import { LiveNow, RunWatch } from "./RunWatch";
import { watchViews } from "./words";

const NAV = [
  { href: "/admin", label: copy.admin.nav.overview },
  { href: "/admin/runs", label: copy.admin.nav.runs },
  { href: "/admin/errors", label: copy.admin.nav.errors },
  { href: "/admin/changes", label: copy.admin.changes.title },
] as const;

/** Where the page sits in the admin nav: the nav link that gets `aria-current` (issue 585). */
export type AdminSection = (typeof NAV)[number]["href"];

export async function AdminShell({
  title,
  section,
  children,
}: {
  title: string;
  section: AdminSection;
  children?: ReactNode;
}) {
  const session = await adminSession();
  return (
    // English whatever the viewer's language (D48): the lang attribute says so for this subtree.
    <div lang="en">
      <SiteHeader
        events={[]}
        currentId={null}
        homeId={null}
        copy={copy}
        publicPage={false}
        prefetch={false}
      />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        {session === "valid" ? (
          <Unlocked title={title} section={section}>
            {children}
          </Unlocked>
        ) : (
          <PinGate ended={session === "none" ? null : session} />
        )}
      </main>
      <SiteFooter copy={copy} choices={false} />
    </div>
  );
}

async function Unlocked({
  title,
  section,
  children,
}: {
  title: string;
  section: AdminSection;
  children?: ReactNode;
}) {
  const now = new Date();
  const env = getEnv();
  const [[running, [last], [daily], rehearsal], clock] = await Promise.all([
    withPageDb((db) =>
      Promise.all([
        runningSnapshots(db, now),
        listRuns(db, 1),
        listDailyReads(db, 1),
        hasPendingRehearsal(db, now, env.SNAPSHOT_WINDOW_MIN * 60_000),
      ]),
    ),
    requestServerClock(),
  ]);
  const views = watchViews(running, last, daily, now, clock);
  // D141 amendment: idle, the watch asks only from the next tick that can start a run; a pending rehearsal
  // is run by a later tick that the clock alone does not foresee, so it asks from now.
  const from = rehearsal ? now.getTime() : pollFrom(now, env);
  return (
    <RunWatch running={views.running} latest={views.latest} pollFrom={from}>
      <nav
        aria-label={copy.admin.nav.label}
        className="mb-3 flex flex-wrap items-center gap-x-1 border-b border-rule"
      >
        {NAV.map((n) => (
          <TextLink
            key={n.href}
            href={n.href}
            prefetch={false}
            aria-current={n.href === section ? "page" : undefined}
            className="flex min-h-11 items-center px-3 text-sm font-medium aria-[current=page]:font-bold aria-[current=page]:shadow-[inset_0_-3px_0_var(--color-plum)]"
          >
            {n.label}
          </TextLink>
        ))}
        {/* One group: it wraps as a unit, so Log out does not jump when the candle's word changes. */}
        <div className="ml-auto flex items-center">
          <LiveNow on={views.running.length > 0} />
          <LogoutButton />
        </div>
      </nav>
      <h1 className="mb-3 font-display text-display-lg">{title}</h1>
      {children}
    </RunWatch>
  );
}
