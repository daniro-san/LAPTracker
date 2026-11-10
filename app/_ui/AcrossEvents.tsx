// "Across events" for an alliance (plan Phase 5e): one card / row per event, newest first, each compared
// with the previous event's reference value (the after snapshot, else the before fallback). Each row shows
// the time its figures are from, so the fallback reads as `10:00` without a word (07c S1). Under each
// change, `since 10:00` gives the change inside the event, as on the player page (issue 191). The rank is
// the ledger rank by might, moved event over event; kills and server ranks are under Details.
import { rankDelta, type NameHistoryEntry } from "@/lib/compute";
import { fill, type Dictionary } from "@/lib/copy";
import type { HistoryRow } from "@/lib/queries";

import { DetailTable, rankRow, type RankPair } from "./DetailLines";
import { fellWithLeavers } from "./event-rows";
import { EventLead } from "./EventLead";
import { allianceLabel, changeText, joinedText, leftText, type Clock } from "./format";
import { requestCopy } from "./locale";
import { LABEL, StatTable, type StatMetric, type StatRow } from "./StatTable";
import { FreshDots } from "./Status";

const SHOWN = 12;

/** The section's id, for the jump link in the alliance page's title row (07c N5, #51). */
export const ACROSS_ID = "across-events";
/** The alliance page's title row, where the section's back link returns to (#51). */
export const TITLE_ID = "alliance-title";

/** The value before the delta, so the percentage is relative to the previous event. */
const baseOf = (value: number | null, delta: number | null) =>
  value !== null && delta !== null ? value - delta : null;

function rosterNote(r: HistoryRow, copy: Dictionary): Pick<StatMetric, "note"> {
  if (r.joined === null || r.left === null || r.joined === 0 || r.left === 0) return {};
  return { note: `${joinedText(r.joined, copy)} · ${leftText(r.left, copy)}` };
}

/** The change inside the event (before → after) for one figure, under the change since the previous
 * event; Might and Kills carry the `*` (D33) when they fell while members left. */
function inEventLine(
  r: HistoryRow,
  figure: "power" | "kills" | "members",
  clock: Clock,
  copy: Dictionary,
): Pick<StatMetric, "vs"> {
  const e = r.inEvent;
  if (!e) return {};
  const delta = e[figure];
  const base =
    figure === "power"
      ? e.fromPower
      : figure === "kills"
        ? e.fromKills
        : baseOf(r.memberCount, delta);
  const label = fill(copy.ledger.since, { date: e.fromAt ? clock.hhmm(e.fromAt) : "—" });
  const memberMark = figure !== "members" && fellWithLeavers(delta, e.left);
  return { vs: { label, delta, base, memberMark } };
}

/** A Might or Kills change inside an event carries the `*` (D33): the page's legend needs to know. */
export const inEventMarked = (history: HistoryRow[]) =>
  history.some(
    ({ inEvent: e }) =>
      e !== null && (fellWithLeavers(e.power, e.left) || fellWithLeavers(e.kills, e.left)),
  );

function metrics(
  r: HistoryRow,
  prevMembers: number | null,
  clock: Clock,
  copy: Dictionary,
): StatMetric[] {
  const l = copy.ledger;
  const vs = (figure: "power" | "kills" | "members") => inEventLine(r, figure, clock, copy);
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
      ...vs("power"),
    },
    {
      label: l.kills,
      value: r.totalKills,
      delta: r.step.kills,
      base: baseOf(r.totalKills, r.step.kills),
      ...vs("kills"),
    },
    {
      label: l.members,
      value: r.memberCount,
      delta: memberDelta,
      base: prevMembers,
      ...rosterNote(r, copy),
      ...vs("members"),
    },
  ];
}

/** `Alliance: OLD → NEW`, `Name: Old → New`, for each label that changed since the previous event. */
function changes(r: HistoryRow, copy: Dictionary): string | null {
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
  copy: Dictionary,
): StatRow {
  const change = changes(r, copy);
  const ranks = rankPairs(r, prev);
  const l = copy.ledger;
  return {
    key: String(r.eventId),
    href: `/events/${r.eventId}/alliances/${unionId}`,
    rank: { n: ranks.might.after, move: ranks.might.move },
    lead: <EventLead eventAt={r.eventAtUtc} dataAt={r.updatedAt} clock={clock} />,
    sub: (
      <>
        {allianceLabel(r.tag, r.name)}
        {change && <span className="block text-xs">{change}</span>}
      </>
    ),
    metrics: metrics(r, prev?.memberCount ?? null, clock, copy),
    summary: (
      <FreshDots
        before={null}
        after={{ isFresh: r.isFresh, updatedAt: null, failed: false }}
        copy={copy}
      />
    ),
    detail: (
      <DetailTable
        from={prev ? clock.day(prev.eventAtUtc) : "—"}
        to={clock.day(r.eventAtUtc)}
        rows={[
          rankRow(l.might, ranks.might),
          rankRow(l.kills, ranks.kills),
          rankRow(l.ranking, ranks.server),
        ]}
      />
    ),
  };
}

export async function AcrossEvents({
  unionId,
  history,
  clock,
}: {
  unionId: number;
  history: HistoryRow[];
  clock: Clock;
}) {
  const copy = await requestCopy();
  const rows = history.map((r, i) => toRow(unionId, r, history[i - 1], clock, copy)).reverse();
  const l = copy.ledger;
  const table = (list: StatRow[]) => (
    <StatTable
      leadLabel={l.event}
      columns={[l.might, l.kills, l.members]}
      rows={list}
      empty={copy.empty.noEvents}
      copy={copy}
    />
  );
  return (
    <section id={ACROSS_ID} className="mt-8 scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3">
        <h2 className="font-subhead text-display-md">{l.acrossEvents}</h2>
        <a
          href={`#${TITLE_ID}`}
          className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-plum hover:underline"
        >
          {l.toTop} <span aria-hidden="true">&nbsp;↑</span>
        </a>
      </div>
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

/** The alliance's names across events, only when it had more than one. */
export function NameTimeline({
  names,
  clock,
  copy,
}: {
  names: NameHistoryEntry[];
  clock: Clock;
  copy: Dictionary;
}) {
  if (names.length < 2) return null;
  return (
    <div className="mb-3 text-sm text-ink/70">
      <p className={LABEL}>{copy.ledger.names}</p>
      <ul>
        {names.map((n) => (
          <li key={`${n.tag}|${n.name}`}>
            {allianceLabel(n.tag, n.name)} · {clock.day(n.firstSeen)} – {clock.day(n.lastSeen)}
          </li>
        ))}
      </ul>
    </div>
  );
}
