// The status strip, freshness marks and the legend (DESIGN.md `status-strip`, `legend`). Every state has
// a symbol, a colour and a word: colour is never the only cue. Run errors and quota live on /admin.
import type { ReactNode } from "react";

import { Chip, type ChipTone } from "@/lib/brand/components/Chip";
import { DroppedStitch, Hourglass, StitchedCheck } from "@/lib/brand/components/StatusIcons";
import { copy, fill } from "@/lib/copy";

import type { Clock } from "./format";

export interface PhaseStatus {
  phase: "before" | "after";
  status: "running" | "complete" | "partial" | "failed";
  startedAt: Date;
  finishedAt: Date | null;
}

const CHIP: Record<PhaseStatus["status"], { icon: ReactNode; tone: ChipTone }> = {
  complete: { icon: <StitchedCheck />, tone: "ink" },
  running: { icon: <Hourglass />, tone: "plum" },
  partial: { icon: <DroppedStitch />, tone: "seal" },
  failed: { icon: "✗", tone: "seal" },
} as const;

const STATE_WORD = {
  complete: copy.status.done,
  partial: copy.status.partial,
  failed: copy.status.failed,
} as const;

const finishedAt = (p: PhaseStatus) => p.finishedAt ?? p.startedAt;

/** "Last updated: done at …", or "Updating now"; nothing yet: "Not updated yet". */
function LastChip({ phases, clock }: { phases: PhaseStatus[]; clock: Clock }) {
  const running = phases.find((p) => p.status === "running");
  if (running) {
    return (
      <Chip tone={CHIP.running.tone} icon={CHIP.running.icon}>
        {copy.status.running}
      </Chip>
    );
  }
  const last = phases
    .filter((p): p is PhaseStatus & { status: keyof typeof STATE_WORD } => p.status !== "running")
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
      {fill(copy.status.lastUpdated, {
        state: STATE_WORD[last.status],
        time: clock.at(finishedAt(last)),
      })}
    </Chip>
  );
}

/** "Next update scheduled at …" while a phase is still to run; nothing once both have run. */
function NextChip({
  phases,
  at,
  clock,
}: {
  phases: PhaseStatus[];
  at: { before: Date; after: Date };
  clock: Clock;
}) {
  const next = (["before", "after"] as const).find((ph) => !phases.some((p) => p.phase === ph));
  if (!next) return null;
  return (
    <Chip tone="muted" icon="○">
      {fill(copy.status.next, { time: clock.at(at[next]) })}
    </Chip>
  );
}

export function StatusChips({
  phases,
  beforeAt,
  afterAt,
  clock,
}: {
  phases: PhaseStatus[];
  beforeAt: Date;
  afterAt: Date;
  clock: Clock;
}) {
  return (
    <ul className="flex flex-wrap items-start gap-2" aria-label={copy.status.label}>
      <li className="min-w-0">
        <LastChip phases={phases} clock={clock} />
      </li>
      <li className="min-w-0">
        <NextChip phases={phases} at={{ before: beforeAt, after: afterAt }} clock={clock} />
      </li>
    </ul>
  );
}

export interface FreshState {
  isFresh: boolean;
  updatedAt: Date | null;
  failed: boolean;
}

type FreshWord = keyof typeof copy.fresh;

const wordOf = (s: FreshState | null): FreshWord =>
  !s ? "missing" : s.failed ? "failed" : s.isFresh ? "fresh" : "stale";

const MARK: Record<FreshWord, { symbol: string; tone: string }> = {
  fresh: { symbol: "●", tone: "text-ink" },
  stale: { symbol: "○", tone: "text-seal" },
  failed: { symbol: "✗", tone: "text-seal" },
  missing: { symbol: "–", tone: "text-ink/70" },
};

function Mark({ word }: { word: FreshWord }) {
  return (
    <span className={`whitespace-nowrap font-medium ${MARK[word].tone}`}>
      <span aria-hidden="true">{MARK[word].symbol} </span>
      {copy.fresh[word]}
    </span>
  );
}

/** One mark for the row: Fresh when every snapshot side present is fresh, else the worst state. */
export function FreshDots({
  before,
  after,
}: {
  before: FreshState | null;
  after: FreshState | null;
}) {
  const words = [before, after].filter((s) => s !== null).map(wordOf);
  const worst = (["failed", "stale"] as const).find((w) => words.includes(w)) ?? "fresh";
  return <Mark word={worst} />;
}

/** Before / After, each with its mark and the time of the data. */
export function FreshnessDetail({
  before,
  after,
  clock,
}: {
  before: FreshState | null;
  after: FreshState | null;
  clock: Clock;
}) {
  const line = (label: string, s: FreshState | null) => (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="w-14 font-medium">{label}</span>
      <Mark word={wordOf(s)} />
      {s?.updatedAt && <span className="text-ink/70">{clock.at(s.updatedAt)}</span>}
    </li>
  );
  return (
    <ul>
      {line(copy.ledger.before, before)}
      {line(copy.ledger.after, after)}
    </ul>
  );
}

/** The one legend (DESIGN.md "One legend, once"), under the page title. */
export function Legend({ beforeOnly = false }: { beforeOnly?: boolean }) {
  const l = copy.legend;
  const items: [ReactNode, string, string][] = [
    ["▲", l.up, "text-yarn"],
    ["▼", l.down, "text-seal"],
    ["=", l.same, "text-ink/70"],
    ["#", l.rank, "text-ink"],
    ["●", l.fresh, "text-ink"],
    ["○", l.stale, "text-seal"],
  ];
  if (beforeOnly) items.push([<BeforeMark key="b" />, l.beforeOnly, "text-ink"]);
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

/** The `B` box: this event's figures come from the before snapshot (Phase 5e). The legend names it. */
export function BeforeMark() {
  return (
    <span className="rounded-xs border border-ink/50 px-1 text-xs font-semibold text-ink">B</span>
  );
}
