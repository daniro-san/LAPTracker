// "Across events" for an alliance (plan Phase 5e): one card / row per event, newest first, each compared
// with the previous event's reference value (the after snapshot; `B` marks the before fallback). The rank
// is the ledger rank by might, moved event over event; kills and server ranks are under Details.
import { rankDelta } from "@/lib/compute";
import { copy, fill } from "@/lib/copy";
import type { HistoryRow } from "@/lib/queries";

import { RankLine, type RankPair } from "./DetailLines";
import { allianceLabel, changeText, joinedText, leftText, type Clock } from "./format";
import { StatTable, type StatMetric, type StatRow } from "./StatTable";
import { BeforeMark, FreshDots } from "./Status";

const SHOWN = 12;

/** The value before the delta, so the percentage is relative to the previous event. */
const baseOf = (value: number | null, delta: number | null) =>
  value !== null && delta !== null ? value - delta : null;

function rosterNote(r: HistoryRow): Pick<StatMetric, "note"> {
  if (r.joined === null || r.left === null || r.joined === 0 || r.left === 0) return {};
  return { note: `${joinedText(r.joined)} · ${leftText(r.left)}` };
}

function metrics(r: HistoryRow, prevMembers: number | null): StatMetric[] {
  const l = copy.ledger;
  const memberDelta =
    r.isFresh && r.memberCount !== null && prevMembers !== null
      ? r.memberCount - prevMembers
      : null;
  return [
    {
      label: l.might,
      value: r.totalPower,
      delta: r.step.power,
      base: baseOf(r.totalPower, r.step.power),
    },
    {
      label: l.kills,
      value: r.totalKills,
      delta: r.step.kills,
      base: baseOf(r.totalKills, r.step.kills),
    },
    {
      label: l.members,
      value: r.memberCount,
      delta: memberDelta,
      base: prevMembers,
      ...rosterNote(r),
    },
    { label: l.level, value: r.level, delta: r.step.lv, base: null },
  ];
}

/** `Alliance: OLD → NEW`, `Name: Old → New`, for each label that changed since the previous event. */
function changes(r: HistoryRow): string | null {
  if (!r.previous) return null;
  const line = (label: string, from: string | null, to: string | null) =>
    changeText(label, from ?? "?", to ?? "?");
  const parts: string[] = [];
  if (r.step.changed.tag) parts.push(line(copy.ledger.alliance, r.previous.tag, r.tag));
  if (r.step.changed.name) parts.push(line(copy.members.name, r.previous.name, r.name));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function rankPairs(r: HistoryRow, prev: HistoryRow | undefined) {
  const canMove = prev !== undefined && prev.isFresh && r.isFresh;
  const pair = (from: number | null | undefined, to: number | null): RankPair => ({
    before: from ?? null,
    after: to,
    move: canMove ? rankDelta(from, to) : null,
  });
  return {
    might: pair(prev?.ledger?.might, r.ledger?.might ?? null),
    kills: pair(prev?.ledger?.kills, r.ledger?.kills ?? null),
    server: pair(prev?.serverRank, r.serverRank),
  };
}

function toRow(
  unionId: number,
  r: HistoryRow,
  prev: HistoryRow | undefined,
  clock: Clock,
): StatRow {
  const change = changes(r);
  const ranks = rankPairs(r, prev);
  const l = copy.ledger;
  return {
    key: String(r.eventId),
    href: `/events/${r.eventId}/alliances/${unionId}`,
    rank: { n: ranks.might.after, move: ranks.might.move },
    lead: (
      <span className="inline-flex items-center gap-2">
        {clock.weekday(r.eventAtUtc)}
        {r.reference === "before" && <BeforeMark />}
      </span>
    ),
    sub: (
      <>
        {allianceLabel(r.tag, r.name)}
        {change && <span className="block text-xs">{change}</span>}
      </>
    ),
    metrics: metrics(r, prev?.memberCount ?? null),
    summary: (
      <FreshDots before={null} after={{ isFresh: r.isFresh, updatedAt: null, failed: false }} />
    ),
    detail: (
      <ul>
        <RankLine label={l.might} pair={ranks.might} />
        <RankLine label={l.kills} pair={ranks.kills} />
        <RankLine label={l.server} pair={ranks.server} />
      </ul>
    ),
  };
}

export function AcrossEvents({
  unionId,
  history,
  clock,
}: {
  unionId: number;
  history: HistoryRow[];
  clock: Clock;
}) {
  const rows = history.map((r, i) => toRow(unionId, r, history[i - 1], clock)).reverse();
  const l = copy.ledger;
  const table = (list: StatRow[]) => (
    <StatTable
      leadLabel={l.event}
      columns={[l.might, l.kills, l.members, l.level]}
      rows={list}
      empty={copy.empty.noEvents}
    />
  );
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-subhead text-display-md">{l.acrossEvents}</h2>
      {table(rows.slice(0, SHOWN))}
      {rows.length > SHOWN && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-plum">
            {fill(l.showAll, { n: rows.length })}
          </summary>
          {table(rows.slice(SHOWN))}
        </details>
      )}
    </section>
  );
}
