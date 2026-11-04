// Snapshot status chips and freshness dots (plan Phase 5). Every state has a symbol and a word:
// colour is never the only cue.
import { utcClock, utcStamp } from "./format";

export interface PhaseStatus {
  phase: "before" | "after";
  status: "running" | "complete" | "partial" | "failed";
  startedAt: Date;
  finishedAt: Date | null;
  error?: string | null | undefined;
}

const CHIP = {
  complete: { icon: "✓", tone: "border-emerald-600 text-emerald-800 dark:text-emerald-300" },
  running: { icon: "…", tone: "border-amber-600 text-amber-800 dark:text-amber-300" },
  partial: { icon: "◐", tone: "border-amber-600 text-amber-800 dark:text-amber-300" },
  failed: { icon: "✗", tone: "border-red-600 text-red-800 dark:text-red-300" },
} as const;

const NOT_RUN = "border-zinc-400 text-zinc-600 dark:text-zinc-400";

function Chip({ phase, status }: { phase: "before" | "after"; status: PhaseStatus | undefined }) {
  const style = status ? CHIP[status.status] : { icon: "○", tone: NOT_RUN };
  const when = status ? utcClock(status.finishedAt ?? status.startedAt) : null;
  return (
    <li className="min-w-0">
      <span
        className={`inline-flex min-h-8 items-center gap-1 rounded-xs border px-3 text-sm ${style.tone}`}
      >
        <span aria-hidden="true">{style.icon}</span>
        {phase}: {status ? status.status : "not run"}
        {when && ` ${when}`}
      </span>
      {status?.status === "failed" && status.error && (
        <p className="mt-1 break-words text-sm text-red-800 dark:text-red-300">{status.error}</p>
      )}
    </li>
  );
}

export function StatusChips({ phases }: { phases: PhaseStatus[] }) {
  return (
    <ul className="flex flex-wrap items-start gap-2">
      <Chip phase="before" status={phases.find((p) => p.phase === "before")} />
      <Chip phase="after" status={phases.find((p) => p.phase === "after")} />
    </ul>
  );
}

export interface FreshState {
  isFresh: boolean;
  updatedAt: Date | null;
  failed: boolean;
}

function Dot({ label, state }: { label: string; state: FreshState | null }) {
  const [icon, tone, word] = !state
    ? ["–", "text-zinc-500", "no data"]
    : state.failed || !state.isFresh
      ? ["○", "text-red-700 dark:text-red-400", state.failed ? "failed" : "stale"]
      : ["●", "text-emerald-700 dark:text-emerald-400", "fresh"];
  return (
    <span className={`whitespace-nowrap ${tone}`} aria-label={`${label}: ${word}`}>
      {label} <span aria-hidden="true">{icon}</span>
    </span>
  );
}

/** B ● A ○ : before and after freshness, with the exact times in {@link FreshnessDetail}. */
export function FreshDots({
  before,
  after,
}: {
  before: FreshState | null;
  after: FreshState | null;
}) {
  return (
    <span className="flex gap-3 font-medium">
      <Dot label="B" state={before} />
      <Dot label="A" state={after} />
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
        : `${s.failed ? "failed" : s.isFresh ? "fresh" : "stale"}${s.updatedAt ? `, roster updated ${utcStamp(s.updatedAt)}` : ""}`}
    </li>
  );
  return (
    <ul>
      {line("Before", before)}
      {line("After", after)}
    </ul>
  );
}
