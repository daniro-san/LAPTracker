// "Across events" for a player (plan Phase 5e): one card / row per event, newest first. Might and kills
// show the change inside the event (before → after) and the change since the previous event.
import type { PlayerEventRow } from "@/lib/queries";

import { utcDay } from "./format";
import { StatTable, type StatMetric, type StatRow } from "./StatTable";
import { FreshDots, FreshnessDetail } from "./Status";

const SHOWN = 12;

type Stat = "power" | "kills" | "lv";
const FROM = { power: "fromPower", kills: "fromKills", lv: "fromLv" } as const;

const baseOf = (value: number | null, delta: number | null) =>
  value !== null && delta !== null ? value - delta : null;

function metric(label: string, field: Stat, r: PlayerEventRow): StatMetric {
  const from = r.inEvent?.[FROM[field]] ?? null;
  return {
    label,
    value: r[field],
    ...(from !== null ? { from } : {}),
    delta: r.inEvent?.[field] ?? null,
    base: field === "lv" ? null : from,
    vs: {
      label: "Since previous event",
      delta: r.step[field],
      base: field === "lv" ? null : baseOf(r[field], r.step[field]),
    },
  };
}

function changes(r: PlayerEventRow): React.ReactNode {
  if (!r.previous) return null;
  const parts: string[] = [];
  if (r.step.changed.name) parts.push(`name: was ${r.previous.name}, now ${r.name}`);
  if (r.step.changed.alliance)
    parts.push(`alliance: was ${r.previous.tag ?? "?"}, now ${r.tag ?? "?"}`);
  return parts.length > 0 ? <span className="block text-xs">{parts.join(" · ")}</span> : null;
}

function toRow(r: PlayerEventRow): StatRow {
  return {
    key: String(r.eventId),
    href: `/events/${r.eventId}/alliances/${r.unionId}`,
    lead: (
      <>
        {utcDay(r.eventAtUtc)}
        {r.reference === "before" && (
          <abbr
            title="Not on the after-event roster: showing the before snapshot"
            className="ml-2 rounded-xs border border-ink/50 px-1 text-xs no-underline"
          >
            B
          </abbr>
        )}
      </>
    ),
    sub: (
      <>
        {r.name} · {r.tag}
        {changes(r)}
      </>
    ),
    metrics: [metric("Might", "power", r), metric("Kills", "kills", r), metric("Level", "lv", r)],
    summary: (
      <FreshDots
        before={r.before && { ...r.before, failed: false }}
        after={r.after && { ...r.after, failed: false }}
      />
    ),
    detail: (
      <FreshnessDetail
        before={r.before && { ...r.before, failed: false }}
        after={r.after && { ...r.after, failed: false }}
      />
    ),
  };
}

export function PlayerAcrossEvents({ rows }: { rows: PlayerEventRow[] }) {
  const newestFirst = rows.map(toRow).reverse();
  const table = (list: StatRow[]) => (
    <StatTable
      leadLabel="Event"
      columns={["Might", "Kills", "Level"]}
      rows={list}
      empty="No events recorded."
    />
  );
  return (
    <section className="mt-8">
      <h2 className="mb-1 font-display text-display-md font-semibold">History across events</h2>
      <p className="mb-3 text-sm text-ink/70">
        Each row shows the change during that event (before to after) and the change since the event
        before. “B” means the player was not on the after-event roster, so the before snapshot is
        shown. Tap a row to open the alliance.
      </p>
      {table(newestFirst.slice(0, SHOWN))}
      {newestFirst.length > SHOWN && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            Show all {newestFirst.length} events
          </summary>
          {table(newestFirst.slice(SHOWN))}
        </details>
      )}
    </section>
  );
}
