// The status strip, freshness marks and the legend (DESIGN.md `status-strip`, `legend`). Every state has
// a symbol, a colour and a word: colour is never the only cue. Run errors and quota live on /admin.
import type { ReactNode } from "react";

import { Chip, type ChipTone } from "@/lib/brand/components/Chip";
import { DroppedStitch, Hourglass, StitchedCheck } from "@/lib/brand/components/StatusIcons";
import { fill, type Dictionary } from "@/lib/copy";

import { MEMBER_MARK, type Clock } from "./format";

export interface PhaseStatus {
  phase: "before" | "after";
  status: "running" | "complete" | "partial" | "failed";
  startedAt: Date;
  finishedAt: Date | null;
}

// The time chip stays ink in every finished state (07c B1: a red chip read as "do not trust this time");
// what went wrong is the separate seal count of stale rows beside it.
const CHIP: Record<PhaseStatus["status"], { icon: ReactNode; tone: ChipTone }> = {
  complete: { icon: <StitchedCheck />, tone: "ink" },
  running: { icon: <Hourglass />, tone: "plum" },
  partial: { icon: <DroppedStitch />, tone: "ink" },
  failed: { icon: "✗", tone: "ink" },
} as const;

const finishedAt = (p: PhaseStatus) => p.finishedAt ?? p.startedAt;

/** "Last updated at …" (a partial run shows its icon and the stale count beside it), "Last update
 * failed at …", "Updating now"; nothing yet: "Not updated yet" (owner, 2026-11-05). */
function LastChip({
  phases,
  clock,
  copy,
}: {
  phases: PhaseStatus[];
  clock: Clock;
  copy: Dictionary;
}) {
  const running = phases.find((p) => p.status === "running");
  if (running) {
    return (
      <Chip tone={CHIP.running.tone} icon={CHIP.running.icon}>
        {copy.status.running}
      </Chip>
    );
  }
  const last = phases
    .filter((p) => p.status !== "running")
    .sort((a, b) => finishedAt(b).getTime() - finishedAt(a).getTime())[0];
  if (!last) {
    return (
      <Chip tone="muted" icon="○">
        {copy.status.none}
      </Chip>
    );
  }
  return (
    <Chip tone={CHIP[last.status].tone} icon={CHIP[last.status].icon}>
      {fill(last.status === "failed" ? copy.status.lastFailed : copy.status.lastUpdated, {
        time: clock.at(finishedAt(last)),
      })}
    </Chip>
  );
}

/** "Next update at …": the next snapshot, of this event or of the schedule (app/_ui/event-rows.ts). */
function NextChip({ at, clock, copy }: { at: Date | null; clock: Clock; copy: Dictionary }) {
  if (!at) return null;
  return (
    <Chip tone="muted" icon="○">
      {fill(copy.status.next, { time: clock.at(at) })}
    </Chip>
  );
}

/** A manual round (D28) is never run by the tick, so it names no next time. */
function ByHandChip({ copy }: { copy: Dictionary }) {
  return (
    <Chip tone="muted" icon="○">
      {copy.status.byHand}
    </Chip>
  );
}

export function StatusChips({
  phases,
  nextAt,
  stale,
  manual = false,
  clock,
  copy,
}: {
  phases: PhaseStatus[];
  nextAt: Date | null;
  /** Rows marked stale or failed: shown as a seal `○ n` beside the time, never as the time's tone. */
  stale: number;
  /** A manual round: "Run by hand by the admin" replaces "Next update at …". */
  manual?: boolean;
  clock: Clock;
  copy: Dictionary;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label={copy.status.label}>
      <li className="min-w-0">
        <LastChip phases={phases} clock={clock} copy={copy} />
      </li>
      {stale > 0 && (
        <li className="min-w-0 text-body-sm">
          <span className="whitespace-nowrap font-medium text-seal">
            <span aria-hidden="true">○ </span>
            {fill(copy.status.stale, { n: stale })}
          </span>
        </li>
      )}
      <li className="min-w-0">
        {manual ? <ByHandChip copy={copy} /> : <NextChip at={nextAt} clock={clock} copy={copy} />}
      </li>
    </ul>
  );
}

export interface FreshState {
  isFresh: boolean;
  updatedAt: Date | null;
  failed: boolean;
}

type FreshWord = keyof Dictionary["fresh"];

const wordOf = (s: FreshState | null): FreshWord =>
  !s ? "missing" : s.failed ? "failed" : s.isFresh ? "fresh" : "stale";

/** The row's worst state over the snapshot sides present; "fresh" when nothing is wrong. */
export function worstOf(before: FreshState | null, after: FreshState | null): FreshWord {
  const words = [before, after].filter((s) => s !== null).map(wordOf);
  return (["failed", "stale"] as const).find((w) => words.includes(w)) ?? "fresh";
}

const MARK: Record<FreshWord, { symbol: string; tone: string }> = {
  fresh: { symbol: "●", tone: "text-ink" },
  stale: { symbol: "○", tone: "text-seal" },
  failed: { symbol: "✗", tone: "text-seal" },
  missing: { symbol: "–", tone: "text-ink/70" },
};

function Mark({ word, copy }: { word: FreshWord; copy: Dictionary }) {
  return (
    <span className={`whitespace-nowrap font-medium ${MARK[word].tone}`}>
      <span aria-hidden="true">{MARK[word].symbol} </span>
      {copy.fresh[word]}
    </span>
  );
}

/** The row's mark, only when something is wrong (07c S2: "Fresh" on history meant nothing). */
export function FreshDots({
  before,
  after,
  copy,
}: {
  before: FreshState | null;
  after: FreshState | null;
  copy: Dictionary;
}) {
  const worst = worstOf(before, after);
  return worst === "fresh" ? null : <Mark word={worst} copy={copy} />;
}

/** One snapshot side as a column head: its time (`10:00`), with the mark only when it is not fresh. */
export function SideHead({
  s,
  clock,
  copy,
}: {
  s: FreshState | null;
  clock: Clock;
  copy: Dictionary;
}) {
  const word = wordOf(s);
  return (
    <span className="whitespace-nowrap">
      {word !== "fresh" && (
        <span className={MARK[word].tone}>
          <span aria-hidden="true">{MARK[word].symbol} </span>
          <span className="sr-only">{copy.fresh[word]} </span>
        </span>
      )}
      {s?.updatedAt ? clock.hhmm(s.updatedAt) : null}
    </span>
  );
}

/** The one legend (DESIGN.md "One legend, once"), under the page title. `memberMark`: the page shows a `*`
 * on some change, so its item is listed; otherwise the legend does not grow for nothing. */
export function Legend({ memberMark = false, copy }: { memberMark?: boolean; copy: Dictionary }) {
  const l = copy.legend;
  const items: [ReactNode, string, string][] = [
    ["▲", l.up, "text-yarn"],
    ["▼", l.down, "text-seal"],
    ["=", l.same, "text-ink/70"],
    ["#", l.rank, "text-ink"],
    ["○", l.stale, "text-seal"],
    ["≈", l.rounded, "text-ink"],
    ...(memberMark ? [[MEMBER_MARK, l.members, "text-ink"] as [ReactNode, string, string]] : []),
  ];
  return (
    <ul
      aria-label={l.label}
      className="my-3 flex flex-wrap gap-x-4 gap-y-1 border-y border-rule py-2 text-xs text-ink/70"
    >
      {items.map(([symbol, word, tone], i) => (
        <li key={i} className="inline-flex items-center gap-1">
          <span aria-hidden="true" className={`font-semibold ${tone}`}>
            {symbol}
          </span>
          {word}
        </li>
      ))}
    </ul>
  );
}
