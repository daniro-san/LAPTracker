// Snapshot status chips and freshness dots (plan Phase 5). Every state has a symbol and a word:
// colour is never the only cue.
import type { ReactNode } from "react";

import { Chip, type ChipTone } from "@/lib/brand/components/Chip";
import { DroppedStitch, Hourglass, StitchedCheck } from "@/lib/brand/components/StatusIcons";

import { utcStamp } from "./format";

export interface PhaseStatus {
  phase: "before" | "after";
  status: "running" | "complete" | "partial" | "failed";
  startedAt: Date;
  finishedAt: Date | null;
  error?: string | null | undefined;
}

const CHIP: Record<PhaseStatus["status"], { icon: ReactNode; tone: ChipTone }> = {
  complete: { icon: <StitchedCheck />, tone: "ink" },
  running: { icon: <Hourglass />, tone: "plum" },
  partial: { icon: <DroppedStitch />, tone: "seal" },
  failed: { icon: "✗", tone: "seal" },
} as const;

const STATUS_WORD = {
  complete: "done",
  partial: "partly done",
  failed: "failed",
} as const;

const finishedAt = (p: PhaseStatus) => p.finishedAt ?? p.startedAt;

/** "Last updated: done at …", or "Updating now"; nothing yet: "Not updated yet". */
function LastChip({ phases }: { phases: PhaseStatus[] }) {
  const running = phases.find((p) => p.status === "running");
  if (running) {
    return (
      <Chip tone={CHIP.running.tone} icon={CHIP.running.icon}>
        Updating now
      </Chip>
    );
  }
  const last = phases
    .filter((p): p is PhaseStatus & { status: keyof typeof STATUS_WORD } => p.status !== "running")
    .sort((a, b) => finishedAt(b).getTime() - finishedAt(a).getTime())[0];
  if (!last) {
    return (
      <Chip tone="muted" icon="○">
        Not updated yet
      </Chip>
    );
  }
  return (
    <Chip tone={CHIP[last.status].tone} icon={CHIP[last.status].icon}>
      Last updated: {STATUS_WORD[last.status]} at {utcStamp(finishedAt(last))}
    </Chip>
  );
}

/** "Next update scheduled at …" while a phase is still to run; nothing once both have run. */
function NextChip({ phases, at }: { phases: PhaseStatus[]; at: { before: Date; after: Date } }) {
  const next = (["before", "after"] as const).find((ph) => !phases.some((p) => p.phase === ph));
  if (!next) return null;
  return (
    <Chip tone="muted" icon="○">
      Next update scheduled at {utcStamp(at[next])}
    </Chip>
  );
}

export function StatusChips({
  phases,
  beforeAt,
  afterAt,
}: {
  phases: PhaseStatus[];
  beforeAt: Date;
  afterAt: Date;
}) {
  const failed = phases.filter((p) => p.status === "failed" && p.error);
  return (
    <div>
      <ul className="flex flex-wrap items-start gap-2">
        <li className="min-w-0">
          <LastChip phases={phases} />
        </li>
        <li className="min-w-0">
          <NextChip phases={phases} at={{ before: beforeAt, after: afterAt }} />
        </li>
      </ul>
      {failed.map((p) => (
        <p key={p.phase} className="mt-1 break-words text-sm text-seal">
          {p.error}
        </p>
      ))}
      {phases.some((p) => p.status === "partial") && (
        <p className="mt-2 text-sm text-ink/70">
          Some alliances could not be refreshed, so their changes are not shown.
        </p>
      )}
    </div>
  );
}

export interface FreshState {
  isFresh: boolean;
  updatedAt: Date | null;
  failed: boolean;
}

const problem = (s: FreshState | null) => s !== null && (s.failed || !s.isFresh);

/** One plain phrase: "Data up to date" or which snapshot has out-of-date data. Times are in the details. */
export function FreshDots({
  before,
  after,
}: {
  before: FreshState | null;
  after: FreshState | null;
}) {
  const bad = [problem(before) && "before", problem(after) && "after"].filter(Boolean);
  if (bad.length === 0) {
    return (
      <span className="font-medium text-ink">
        <span aria-hidden="true">● </span>Data up to date
      </span>
    );
  }
  return (
    <span className="font-medium text-seal">
      <span aria-hidden="true">○ </span>Out-of-date data in the {bad.join(" and ")} snapshot
    </span>
  );
}

export function FreshnessDetail({
  before,
  after,
}: {
  before: FreshState | null;
  after: FreshState | null;
}) {
  const line = (label: string, s: FreshState | null) => (
    <li>
      {label}:{" "}
      {!s
        ? "no data"
        : `${s.failed ? "could not be fetched" : s.isFresh ? "data was fresh" : "data was out of date, so changes are not shown"}${s.updatedAt ? ` (updated ${utcStamp(s.updatedAt)})` : ""}`}
    </li>
  );
  return (
    <ul>
      {line("Before snapshot", before)}
      {line("After snapshot", after)}
    </ul>
  );
}
