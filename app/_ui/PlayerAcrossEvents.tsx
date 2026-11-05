// "Across events" for a player (plan Phase 5e): one card / row per event, newest first. Might and kills
// show the change inside the event (before → after) and the change since the previous event. The rank is
// the player's ledger rank by might inside their alliance, moved event over event while they stay in it.
import { rankDelta } from "@/lib/compute";
import { copy, fill } from "@/lib/copy";
import type { PlayerEventRow } from "@/lib/queries";

import { RankLine, type RankPair } from "./DetailLines";
import { allianceLabel, changeText, type Clock } from "./format";
import { StatTable, type StatMetric, type StatRow } from "./StatTable";
import { BeforeMark, FreshDots, FreshnessDetail } from "./Status";

const SHOWN = 12;

type Stat = "power" | "kills" | "lv";
const FROM = { power: "fromPower", kills: "fromKills", lv: "fromLv" } as const;

const baseOf = (value: number | null, delta: number | null) =>
  value !== null && delta !== null ? value - delta : null;

/** `since Oct 24`: the previous event named by its date, which reads without words (persona test, 7b). */
function metric(label: string, field: Stat, r: PlayerEventRow, since: string | null): StatMetric {
  const from = r.inEvent?.[FROM[field]] ?? null;
  return {
    label,
    value: r[field],
    ...(from !== null ? { from } : {}),
    delta: r.inEvent?.[field] ?? null,
    base: field === "lv" ? null : from,
    ...(since !== null && {
      vs: {
        label: since,
        delta: r.step[field],
        base: field === "lv" ? null : baseOf(r[field], r.step[field]),
      },
    }),
  };
}

/** `Name: Old → New`, `Alliance: [OLD] → [NEW]`, for what changed since the previous event. */
function changes(r: PlayerEventRow): React.ReactNode {
  if (!r.previous) return null;
  const parts: string[] = [];
  if (r.step.changed.name) parts.push(changeText(copy.members.name, r.previous.name, r.name));
  if (r.step.changed.alliance) {
    const tag = (t: string | null) => (t === null ? "?" : `[${t}]`);
    parts.push(changeText(copy.ledger.alliance, tag(r.previous.tag), tag(r.tag)));
  }
  return parts.length > 0 ? <span className="block text-xs">{parts.join(" · ")}</span> : null;
}

const freshOf = (r: PlayerEventRow) => ({
  before: r.before && { ...r.before, failed: false },
  after: r.after && { ...r.after, failed: false },
});

/** In-alliance ranks vs the previous event; they move only within one alliance and with fresh data. */
function rankPairs(r: PlayerEventRow, prev: PlayerEventRow | undefined) {
  const canMove = prev !== undefined && prev.unionId === r.unionId && !r.step.changed.alliance;
  const pair = (key: "might" | "kills"): RankPair => ({
    before: prev?.rank[key] ?? null,
    after: r.rank[key],
    move: canMove && r.step.power !== null ? rankDelta(prev.rank[key], r.rank[key]) : null,
  });
  return { might: pair("might"), kills: pair("kills") };
}

function toRow(r: PlayerEventRow, prev: PlayerEventRow | undefined, clock: Clock): StatRow {
  const ranks = rankPairs(r, prev);
  const since = prev ? fill(copy.ledger.since, { date: clock.day(prev.eventAtUtc) }) : null;
  const fresh = freshOf(r);
  const l = copy.ledger;
  return {
    key: String(r.eventId),
    href: `/events/${r.eventId}/alliances/${r.unionId}`,
    rank: { n: ranks.might.after, move: ranks.might.move },
    lead: (
      <span className="inline-flex items-center gap-2">
        {clock.weekday(r.eventAtUtc)}
        {r.reference === "before" && <BeforeMark />}
      </span>
    ),
    sub: (
      <>
        {allianceLabel(r.tag, r.allianceName)}
        {changes(r)}
      </>
    ),
    metrics: [
      metric(l.might, "power", r, since),
      metric(l.kills, "kills", r, since),
      metric(l.level, "lv", r, since),
    ],
    summary: <FreshDots {...fresh} />,
    detail: (
      <div className="grid gap-3 sm:grid-cols-2">
        <ul>
          <RankLine label={l.might} pair={ranks.might} />
          <RankLine label={l.kills} pair={ranks.kills} />
        </ul>
        <FreshnessDetail {...fresh} clock={clock} />
      </div>
    ),
  };
}

export function PlayerAcrossEvents({ rows, clock }: { rows: PlayerEventRow[]; clock: Clock }) {
  const newestFirst = rows.map((r, i) => toRow(r, rows[i - 1], clock)).reverse();
  const l = copy.ledger;
  const table = (list: StatRow[]) => (
    <StatTable
      leadLabel={l.event}
      columns={[l.might, l.kills, l.level]}
      rows={list}
      empty={copy.empty.noEvents}
    />
  );
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-subhead text-display-md">{l.acrossEvents}</h2>
      {table(newestFirst.slice(0, SHOWN))}
      {newestFirst.length > SHOWN && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-plum">
            {fill(l.showAll, { n: newestFirst.length })}
          </summary>
          {table(newestFirst.slice(SHOWN))}
        </details>
      )}
    </section>
  );
}
