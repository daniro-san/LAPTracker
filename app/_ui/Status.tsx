// Snapshot status chips and freshness dots (plan Phase 5). Every state has a symbol and a word:
// colour is never the only cue.
import type { ReactNode } from "react";

import { DroppedStitch, Hourglass, StitchedCheck } from "@/lib/brand/components/StatusIcons";

import { relative, utcClock, utcStamp } from "./format";

export interface PhaseStatus {
  phase: "before" | "after";
  status: "running" | "complete" | "partial" | "failed";
  startedAt: Date;
  finishedAt: Date | null;
  error?: string | null | undefined;
}

const CHIP: Record<PhaseStatus["status"], { icon: ReactNode; tone: string }> = {
  complete: { icon: <StitchedCheck />, tone: "border-ink text-ink" },
  running: { icon: <Hourglass />, tone: "border-plum text-plum" },
  partial: { icon: <DroppedStitch />, tone: "border-seal text-seal" },
  failed: { icon: "✗", tone: "border-seal text-seal" },
} as const;

const PHASE = { before: "Before snapshot", after: "After snapshot" } as const;
const STATUS_WORD = {
  complete: "done",
  running: "in progress",
  partial: "partly done",
  failed: "failed",
} as const;
const NOT_RUN = "border-ink/50 text-ink/70";

function Chip({ phase, status }: { phase: "before" | "after"; status: PhaseStatus | undefined }) {
  const style = status ? CHIP[status.status] : { icon: "○", tone: NOT_RUN };
  const when = status ? utcClock(status.finishedAt ?? status.startedAt) : null;
  return (
    <li className="min-w-0">
      <span
        className={`inline-flex min-h-8 items-center gap-1 rounded-xs border px-3 text-sm ${style.tone}`}
      >
        <span aria-hidden="true" className="inline-flex">
          {style.icon}
        </span>
        {PHASE[phase]}: {status ? STATUS_WORD[status.status] : "not taken yet"}
        {when && ` at ${when}`}
      </span>
      {status?.status === "failed" && status.error && (
        <p className="mt-1 break-words text-sm text-seal">{status.error}</p>
      )}
    </li>
  );
}

export function StatusChips({ phases }: { phases: PhaseStatus[] }) {
  return (
    <div>
      <ul className="flex flex-wrap items-start gap-2">
        <Chip phase="before" status={phases.find((p) => p.phase === "before")} />
        <Chip phase="after" status={phases.find((p) => p.phase === "after")} />
      </ul>
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

const label = (p: "before" | "after") => (p === "before" ? "before-event" : "after-event");

/** "Last sync: AFTER, 4 h ago" and "Next sync: none" (or the next due phase), in plain words. */
export function SyncLines({
  phases,
  beforeAt,
  afterAt,
  now,
}: {
  phases: PhaseStatus[];
  beforeAt: Date;
  afterAt: Date;
  now: Date;
}) {
  const running = phases.find((p) => p.status === "running");
  const done = phases
    .filter((p) => p.status !== "running")
    .sort(
      (a, b) => (b.finishedAt ?? b.startedAt).getTime() - (a.finishedAt ?? a.startedAt).getTime(),
    );
  const last = done[0];
  const missing = (["before", "after"] as const).find((ph) => !phases.some((p) => p.phase === ph));
  const due = missing === "before" ? beforeAt : afterAt;
  return (
    <p className="mb-3 text-sm text-ink/70">
      {running
        ? `Syncing now: ${label(running.phase)} snapshot.`
        : last
          ? `Last sync: ${label(last.phase)} snapshot, ${relative(now, last.finishedAt ?? last.startedAt)} (${utcStamp(last.finishedAt ?? last.startedAt)}).`
          : "Last sync: none yet."}
      <br />
      {missing
        ? `Next sync: ${label(missing)} snapshot, ${due > now ? "due" : "was due"} ${relative(now, due)} (${utcStamp(due)}).`
        : "Next sync: none, this event is finished."}
    </p>
  );
}
