// "Across events" (plan Phase 5e): one card / row per event, newest first, each compared with the
// previous event's reference value (the after snapshot; a `B` marks the before fallback).
import type { HistoryRow } from "@/lib/queries";

import { utcDay } from "./format";
import { StatTable, type StatMetric, type StatRow } from "./StatTable";

const MINUS = "−";
const SHOWN = 12;

/** The value before the delta, so the percentage is relative to the previous event. */
const baseOf = (value: number | null, delta: number | null) =>
  value !== null && delta !== null ? value - delta : null;

function metrics(r: HistoryRow, prevMembers: number | null): StatMetric[] {
  const memberDelta =
    r.isFresh && r.memberCount !== null && prevMembers !== null
      ? r.memberCount - prevMembers
      : null;
  return [
    {
      label: "Members",
      value: r.memberCount,
      delta: memberDelta,
      base: prevMembers,
      ...(r.joined !== null && r.left !== null && r.joined + r.left > 0
        ? { note: `+${r.joined}/${MINUS}${r.left}` }
        : {}),
    },
    {
      label: "Might",
      value: r.totalPower,
      delta: r.step.power,
      base: baseOf(r.totalPower, r.step.power),
    },
    {
      label: "Kills",
      value: r.totalKills,
      delta: r.step.kills,
      base: baseOf(r.totalKills, r.step.kills),
    },
    { label: "Level", value: r.level, delta: r.step.lv, base: null },
    { label: "Rank", value: r.serverRank, delta: null },
  ];
}

function changes(r: HistoryRow): string | null {
  const parts: string[] = [];
  if (r.previous && r.step.changed.tag)
    parts.push(`tag ${r.previous.tag ?? "?"} → ${r.tag ?? "?"}`);
  if (r.previous && r.step.changed.name)
    parts.push(`name ${r.previous.name ?? "?"} → ${r.name ?? "?"}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function toRow(unionId: number, r: HistoryRow, prevMembers: number | null): StatRow {
  const change = changes(r);
  return {
    key: String(r.eventId),
    href: `/events/${r.eventId}/alliances/${unionId}`,
    lead: (
      <>
        {utcDay(r.eventAtUtc)}
        {r.reference === "before" && (
          <abbr
            title="No usable after snapshot: showing the before snapshot"
            className="ml-2 rounded border border-zinc-400 px-1 text-xs no-underline"
          >
            B
          </abbr>
        )}
      </>
    ),
    sub: (
      <>
        {r.tag} · {r.name}
        {change && <span className="block text-xs">{change}</span>}
      </>
    ),
    metrics: metrics(r, prevMembers),
  };
}

export function AcrossEvents({ unionId, history }: { unionId: number; history: HistoryRow[] }) {
  const rows = history
    .map((r, i) => toRow(unionId, r, history[i - 1]?.memberCount ?? null))
    .reverse();
  const table = (list: StatRow[]) => (
    <StatTable
      leadLabel="Event"
      columns={["Members", "Might", "Kills", "Level", "Rank"]}
      rows={list}
      empty="No events recorded."
    />
  );
  return (
    <section className="mt-8">
      <h2 className="mb-1 text-lg font-bold">Across events</h2>
      <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
        After snapshot of each event, changes against the event before. B = before snapshot used.
      </p>
      {table(rows.slice(0, SHOWN))}
      {rows.length > SHOWN && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            Show all {rows.length} events
          </summary>
          {table(rows.slice(SHOWN))}
        </details>
      )}
    </section>
  );
}
