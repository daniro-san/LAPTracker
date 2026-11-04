// `/events/[id]/alliances/[unionId]`: one alliance in one event, then across events (plan Phase 5c, 5e).
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcrossEvents } from "@/app/_ui/AcrossEvents";
import { utcDay } from "@/app/_ui/format";
import { memberViews } from "@/app/_ui/member-views";
import { MembersExplorer } from "@/app/_ui/MembersExplorer";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { StatTable, type StatMetric } from "@/app/_ui/StatTable";
import { FreshDots, FreshnessDetail, type FreshState } from "@/app/_ui/Status";
import type { NameHistoryEntry } from "@/lib/compute";
import { withPageDb } from "@/lib/page";
import type { AllianceRow } from "@/lib/queries";
import { allianceHistory, allianceNames, getAllianceDetail, listEvents } from "@/lib/queries";

const usable = (a: AllianceRow | null) => a !== null && a.isFresh && !a.failed;

const title = (a: AllianceRow | null, unionId: string) => `${a?.tag ?? unionId} · ${a?.name ?? ""}`;

const fresh = (a: AllianceRow | null): FreshState | null =>
  a ? { isFresh: a.isFresh, updatedAt: a.sourceUpdatedAt, failed: a.failed } : null;

type Detail = NonNullable<Awaited<ReturnType<typeof getAllianceDetail>>>;

function totalsMetric(
  label: string,
  before: number | null | undefined,
  after: number | null | undefined,
  canDelta: boolean,
): StatMetric {
  const [b, a] = [before ?? null, after ?? null];
  return {
    label,
    value: a ?? b,
    from: b,
    delta: canDelta && a !== null && b !== null ? a - b : null,
    base: b,
  };
}

function Totals({ detail, canDelta }: { detail: Detail; canDelta: boolean }) {
  const { before, after } = detail;
  const now = after ?? before;
  return (
    <StatTable
      leadLabel="Alliance"
      columns={["Members", "Might", "Kills"]}
      rows={[
        {
          key: "totals",
          lead: now?.tag ?? "",
          sub: now?.name ?? "",
          summary: <FreshDots before={fresh(before)} after={fresh(after)} />,
          detail: <FreshnessDetail before={fresh(before)} after={fresh(after)} />,
          metrics: [
            totalsMetric("Members", before?.memberCount, after?.memberCount, canDelta),
            totalsMetric("Might", before?.totalPower, after?.totalPower, canDelta),
            totalsMetric("Kills", before?.totalKills, after?.totalKills, canDelta),
          ],
        },
      ]}
    />
  );
}

function NameTimeline({ names }: { names: NameHistoryEntry[] }) {
  if (names.length < 2) return null;
  return (
    <ul className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
      {names.map((n) => (
        <li key={`${n.tag}|${n.name}`}>
          {n.tag} · {n.name} ({utcDay(n.firstSeen)} – {utcDay(n.lastSeen)})
        </li>
      ))}
    </ul>
  );
}

function loadAlliance(eventId: number, unionId: number) {
  return withPageDb(async (db) => {
    const detail = await getAllianceDetail(db, eventId, unionId);
    if (!detail) return null;
    const [events, history, names] = await Promise.all([
      listEvents(db),
      allianceHistory(db, unionId),
      allianceNames(db, [unionId]),
    ]);
    return { detail, events, history, names: names.get(unionId) ?? [] };
  });
}

export default async function AlliancePage({
  params,
}: {
  params: Promise<{ id: string; unionId: string }>;
}) {
  const p = await params;
  if (!/^\d{1,9}$/.test(p.id) || !/^\d{1,15}$/.test(p.unionId)) notFound();
  const eventId = Number(p.id);
  const unionId = Number(p.unionId);
  const data = await loadAlliance(eventId, unionId);
  if (!data) notFound();
  const { detail, events, history, names } = data;
  const { before, after } = detail;
  const now = after ?? before;
  const canDelta = usable(before) && usable(after);
  const event = events.find((e) => e.id === eventId);
  return (
    <>
      <SiteHeader events={events} currentId={eventId} />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Link
          href={eventId === events[0]?.id ? "/" : `/events/${eventId}`}
          className="flex min-h-11 items-center text-sm underline"
        >
          ← {event ? utcDay(event.eventAtUtc) : "Event"} comparison
        </Link>
        <h1 className="break-words text-xl font-bold [overflow-wrap:anywhere]">
          {title(now, p.unionId)}
        </h1>
        <NameTimeline names={names} />
        <Totals detail={detail} canDelta={canDelta} />
        <h2 className="mb-2 mt-8 text-lg font-bold">Members</h2>
        <MembersExplorer
          members={memberViews(detail.membersBefore, detail.membersAfter)}
          canDelta={canDelta}
        />
        <AcrossEvents unionId={unionId} history={history} />
      </main>
    </>
  );
}
