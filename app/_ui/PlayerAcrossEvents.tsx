// "Across events" for a player (plan Phase 5e): one card / row per event, newest first. The row is the
// alliance page's row shape turned on its side (Session 7g): Might, Kills and Level are columns, and each
// line under them has its own head on the left — the time the values are from, the change since the
// before snapshot (`since 10:00`) and the change since the previous event (`since Oct 24`) — so the two
// changes read apart (07c N2). The rank is the player's ledger rank by might inside their alliance,
// moved event over event while they stay in it.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { rankDelta } from "@/lib/compute";
import { copy, fill } from "@/lib/copy";
import type { PlayerEventRow } from "@/lib/queries";

import { DetailTable, type RankPair } from "./DetailLines";
import { EmptyState } from "./EmptyState";
import { allianceLabel, changeText, type Clock } from "./format";
import { Delta, Num, Rank } from "./Num";
import { LABEL, MoreBar } from "./StatTable";
import { FreshDots, SideHead } from "./Status";

const SHOWN = 12;
const MUTED = "text-ink/70";
/** ≥ 640 px: event · line head · Might · Kills · Level, shared by the header and every row. */
const GRID = {
  "--cols": "minmax(0,1.5fr) minmax(0,1fr) repeat(3,minmax(0,1fr))",
} as CSSProperties;

type Stat = "power" | "kills" | "lv";
const STATS: Stat[] = ["power", "kills", "lv"];
const LABELS = [copy.ledger.might, copy.ledger.kills, copy.ledger.level];
const FROM = { power: "fromPower", kills: "fromKills", lv: "fromLv" } as const;

const baseOf = (value: number | null, delta: number | null) =>
  value !== null && delta !== null ? value - delta : null;

/** `Name: Old → New`, `Alliance: [OLD] → [NEW]`, for what changed since the previous event. */
function changes(r: PlayerEventRow): string | null {
  if (!r.previous) return null;
  const parts: string[] = [];
  if (r.step.changed.name) parts.push(changeText(copy.members.name, r.previous.name, r.name));
  if (r.step.changed.alliance) {
    const tag = (t: string | null) => (t === null ? "?" : `[${t}]`);
    parts.push(changeText(copy.ledger.alliance, tag(r.previous.tag), tag(r.tag)));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
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

/** One line of the row: its head on the left, then a cell per figure, all on one baseline. */
function Line({ head, cells }: { head: ReactNode; cells: ReactNode[] }) {
  return (
    <>
      <span className={`text-xs tabular-nums ${MUTED}`}>{head}</span>
      {cells.map((c, i) => (
        <span key={i} className="text-right tabular-nums">
          {c}
        </span>
      ))}
    </>
  );
}

interface RowProps {
  r: PlayerEventRow;
  prev: PlayerEventRow | undefined;
  clock: Clock;
  showAlliance: boolean;
}

const SPAN = { 1: "", 2: "sm:row-span-2", 3: "sm:row-span-3" } as const;

/** Rank and date on one baseline; the alliance and what changed under them when they say something. */
function RowLead({
  r,
  clock,
  showAlliance,
  rank,
  lines,
}: RowProps & { rank: RankPair; lines: 1 | 2 | 3 }) {
  const note = changes(r);
  return (
    <div
      className={`col-span-full mb-1 border-b border-rule pb-2 sm:col-span-1 sm:mb-0 sm:border-0 sm:pb-0 ${SPAN[lines]}`}
    >
      <div className="flex items-baseline gap-3">
        <span className="text-base">
          <Rank n={rank.after} move={rank.move} />
        </span>
        <Link
          href={`/events/${r.eventId}/alliances/${r.unionId}`}
          className="font-subhead text-display-sm leading-tight text-plum after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
        >
          {clock.weekday(r.eventAtUtc)}
        </Link>
      </div>
      {(showAlliance || note) && (
        <div className={`mt-0.5 break-words text-sm ${MUTED}`}>
          {showAlliance && allianceLabel(r.tag, r.allianceName)}
          {note && <span className="block text-xs">{note}</span>}
        </div>
      )}
    </div>
  );
}

/** A line of changes: `delta(f)` per figure, the percent relative to `base(f)` (none for Level). */
function ChangeLine({
  head,
  delta,
  base,
}: {
  head: string;
  delta: (f: Stat) => number | null;
  base: (f: Stat) => number | null;
}) {
  return (
    <Line
      head={head}
      cells={STATS.map((f) => (
        <span key={f} className="text-sm">
          <Delta delta={delta(f)} base={f === "lv" ? null : base(f)} stack />
        </span>
      ))}
    />
  );
}

/** Details: the before → after snapshot values with the in-event change and the in-alliance rank. */
function rowDetail(r: PlayerEventRow, ranks: ReturnType<typeof rankPairs>, clock: Clock) {
  const l = copy.ledger;
  const fresh = freshOf(r);
  const rankOf = [ranks.might, ranks.kills];
  return (
    <DetailTable
      corner={l.serverTime}
      from={<SideHead s={fresh.before} clock={clock} />}
      to={<SideHead s={fresh.after} clock={clock} />}
      rows={STATS.map((f, i) => {
        const rank = rankOf[i];
        return {
          label: LABELS[i] as string,
          from: <Num n={r.inEvent?.[FROM[f]] ?? null} />,
          to: <Num n={r[f]} />,
          change: <Delta delta={r.inEvent?.[f] ?? null} base={null} />,
          ...(rank && { rank: <Rank n={rank.after} move={rank.move} /> }),
        };
      })}
    />
  );
}

function EventRow(props: RowProps) {
  const { r, prev, clock } = props;
  const ranks = rankPairs(r, prev);
  const dataAt = (r.reference === "before" ? r.before : r.after)?.updatedAt ?? null;
  const beforeAt = r.inEvent ? (r.before?.updatedAt ?? null) : null;
  const lines = (1 + (beforeAt ? 1 : 0) + (prev ? 1 : 0)) as 1 | 2 | 3;
  return (
    <li
      style={GRID}
      className="stat-card relative mb-3 grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 border border-rule p-3 sm:mb-0 sm:grid-cols-[var(--cols)] sm:border-0 sm:border-b sm:py-2"
    >
      <RowLead {...props} rank={ranks.might} lines={lines} />
      {/* Column heads inside the card below 640 px; the table header carries them above. */}
      <span className="sm:hidden" />
      {LABELS.map((h) => (
        <span key={h} className={`${LABEL} text-right sm:hidden`}>
          {h}
        </span>
      ))}
      <Line
        head={dataAt ? clock.time(dataAt) : null}
        cells={STATS.map((f) => (
          <span key={f} className="text-base font-medium">
            <Num n={r[f]} />
          </span>
        ))}
      />
      {beforeAt && (
        <ChangeLine
          head={fill(copy.ledger.since, { date: clock.hhmm(beforeAt) })}
          delta={(f) => r.inEvent?.[f] ?? null}
          base={(f) => r.inEvent?.[FROM[f]] ?? null}
        />
      )}
      {prev && (
        <ChangeLine
          head={fill(copy.ledger.since, { date: clock.day(prev.eventAtUtc) })}
          delta={(f) => r.step[f]}
          base={(f) => baseOf(r[f], r.step[f])}
        />
      )}
      <MoreBar
        row={{
          key: String(r.eventId),
          lead: null,
          metrics: [],
          summary: <FreshDots {...freshOf(r)} />,
          detail: rowDetail(r, ranks, clock),
        }}
      />
    </li>
  );
}

export function PlayerAcrossEvents({
  rows,
  clock,
  showAlliance,
}: {
  rows: PlayerEventRow[];
  clock: Clock;
  /** Name the alliance on each row only when the player has been in more than one. */
  showAlliance: boolean;
}) {
  const l = copy.ledger;
  const newestFirst = rows
    .map((r, i) => (
      <EventRow
        key={r.eventId}
        r={r}
        prev={rows[i - 1]}
        clock={clock}
        showAlliance={showAlliance}
      />
    ))
    .reverse();
  const header = (
    <div
      className={`hidden border-b border-rule px-3 pb-1 sm:grid sm:grid-cols-[var(--cols)] sm:gap-x-3 ${LABEL}`}
      style={GRID}
    >
      <span className="col-span-2">{l.event}</span>
      {LABELS.map((c) => (
        <span key={c} className="text-right">
          {c}
        </span>
      ))}
    </div>
  );
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-subhead text-display-md">{l.acrossEvents}</h2>
      {rows.length === 0 && <EmptyState>{copy.empty.noEvents}</EmptyState>}
      {rows.length > 0 && header}
      <ul>{newestFirst.slice(0, SHOWN)}</ul>
      {newestFirst.length > SHOWN && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-plum">
            {fill(l.showAll, { n: newestFirst.length })}
          </summary>
          <ul>{newestFirst.slice(SHOWN)}</ul>
        </details>
      )}
    </section>
  );
}
