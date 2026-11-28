// The alliance page's Joins & leaves tab (issue 823): joined, left and net for 7 and 30 days, filters All,
// Joined and Left, and one line per person grouped by server day with the alliance they came from or went to.
// The other side is named only when a tracked alliance's daily roster lists them; else "not in a tracked
// alliance", never "no alliance now".
import Link from "next/link";

import { TextLink } from "@/lib/brand/components/TextLink";
import type { Dictionary } from "@/lib/copy";
import type { AllianceMove, AllianceMoves, MoveCounts } from "@/lib/queries";
import { fill } from "@/lib/words";

import { dayDate, signOf, type Clock } from "./format";

const MUTED = "text-ink/70";

export const MOVE_FILTERS = ["all", "joined", "left"] as const;
export type MoveFilter = (typeof MOVE_FILTERS)[number];

export const moveFilterOf = (v: unknown): MoveFilter =>
  v === "joined" || v === "left" ? v : "all";

/** `+4`, `−6`, `0`. */
export const signed = (n: number) => `${signOf(n)}${Math.abs(n)}`;

/** The tab badge: the net change of the last 7 days. */
export const netOf = (c: MoveCounts) => c.joined - c.left;

/** One person's line after their name. */
export function moveText(m: AllianceMove, copy: Dictionary): string {
  const p = copy.alliancePage;
  const tag = m.other ? `[${m.other.tag ?? m.other.unionId}]` : null;
  if (m.kind === "joined") return tag ? fill(p.joinedFrom, { tag }) : p.joinedUntracked;
  return tag ? fill(p.leftTo, { tag }) : p.leftUntracked;
}

/** The moves the filter keeps, grouped by day in the list's order (newest first). */
export function movesByDay(moves: readonly AllianceMove[], filter: MoveFilter) {
  const days = new Map<string, AllianceMove[]>();
  for (const m of moves) {
    if (filter !== "all" && m.kind !== filter) continue;
    const list = days.get(m.day);
    if (list) list.push(m);
    else days.set(m.day, [m]);
  }
  return [...days];
}

function Counts({ heading, c, copy }: { heading: string; c: MoveCounts; copy: Dictionary }) {
  const p = copy.alliancePage;
  const tiles: [string, string][] = [
    [signed(c.joined), copy.ledger.joined],
    [signed(-c.left), copy.ledger.left],
    [signed(netOf(c)), p.net],
  ];
  return (
    <div>
      <h3 className={`text-sm ${MUTED}`}>{heading}</h3>
      <dl className="mt-1 grid grid-cols-3 gap-2">
        {tiles.map(([n, label]) => (
          <div key={label} className="drawn-card px-3 py-2">
            <dt className={`text-sm ${MUTED}`}>{label}</dt>
            <dd className="text-lg font-medium tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function AllianceMovesView({
  data,
  filter,
  hrefOf,
  clock,
  copy,
}: {
  data: AllianceMoves;
  filter: MoveFilter;
  hrefOf: (f: MoveFilter) => string;
  clock: Clock;
  copy: Dictionary;
}) {
  const p = copy.alliancePage;
  const labels: Record<MoveFilter, string> = {
    all: p.all,
    joined: p.joinedFilter,
    left: p.leftFilter,
  };
  const days = movesByDay(data.moves, filter);
  return (
    <section className="mt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Counts heading={p.week} c={data.week} copy={copy} />
        <Counts heading={p.month} c={data.month} copy={copy} />
      </div>
      <p className={`mt-2 text-sm ${MUTED}`}>{p.movesNote}</p>
      <nav aria-label={p.filters} className="mt-3">
        <ul className="flex gap-2">
          {MOVE_FILTERS.map((f) => (
            <li key={f}>
              <Link
                href={hrefOf(f)}
                scroll={false}
                aria-current={f === filter ? "page" : undefined}
                className="drawn-frame-soft tint-button inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-sm font-medium text-plum aria-[current=page]:bg-plum/10"
              >
                {labels[f]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {days.length === 0 ? (
        <p className={`mt-3 text-sm ${MUTED}`}>{data.compared ? p.movesNone : p.movesFirst}</p>
      ) : (
        days.map(([day, moves]) => (
          <section key={day} className="mt-4">
            <h3 className="font-medium">{clock.day(dayDate(day))}</h3>
            <ul className="drawn-card mt-1 divide-y divide-rule">
              {moves.map((m) => (
                <li
                  key={`${m.kind}-${m.uid}`}
                  className="flex flex-wrap items-center gap-x-3 px-3 py-1"
                >
                  <TextLink
                    href={`/players/${m.uid}`}
                    className="inline-flex min-h-11 min-w-0 items-center break-words font-medium"
                  >
                    <bdi>{m.name}</bdi>
                  </TextLink>
                  <span className={`text-sm ${MUTED}`}>{moveText(m, copy)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
