// /admin/runs rows: a snapshot run (opens its page) and a daily roster read (D60: no run page, its
// problems and error are all it has), with the All / Events / Daily reads filter above them.
import Link from "next/link";
import type { ReactNode } from "react";

import type { Clock } from "@/app/_ui/format";
import { Chip } from "@/lib/brand/components/Chip";
import { DroppedStitch } from "@/lib/brand/components/StatusIcons";
import { copy, fill } from "@/lib/copy";
import type { listRuns } from "@/lib/queries/admin";
import type { listDailyReads } from "@/lib/queries/daily-runs";

import { StateChip } from "./parts";
import { eventWord, phaseWord, seconds, stateWord } from "./words";

const t = copy.admin.runs;

export const RUN_FILTERS = ["events", "daily"] as const;
export type RunFilter = (typeof RUN_FILTERS)[number];
export type SnapshotRun = Awaited<ReturnType<typeof listRuns>>[number];
export type DailyRun = Awaited<ReturnType<typeof listDailyReads>>[number];

const ROW = "flex min-h-11 flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-0";

/** Links, not a form: each filter is a URL (`?show=`), the same look as the member history filters. */
export function RunsFilter({ show }: { show: RunFilter | null }) {
  const link = (key: RunFilter | null, label: string) => (
    <li key={key ?? "all"}>
      <Link
        href={key ? `/admin/runs?show=${key}` : "/admin/runs"}
        aria-current={show === key ? "page" : undefined}
        className="drawn-frame-soft tint-button inline-flex min-h-11 items-center px-3 text-sm font-medium text-plum aria-[current=page]:bg-plum/10"
      >
        {label}
      </Link>
    </li>
  );
  return (
    <nav aria-label={t.show} className="mb-3">
      <ul className="flex flex-wrap gap-2">
        {link(null, t.filters.all)}
        {RUN_FILTERS.map((f) => link(f, t.filters[f]))}
      </ul>
    </nav>
  );
}

/** The state chip, the alliances that failed or were stale, and the deadline chip. */
function Flags({
  status,
  problems,
  deadline,
}: {
  status: string;
  problems: { unionId: number; tag: string | null; failed: boolean }[];
  deadline: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:order-last sm:flex-col sm:items-end">
      <StateChip status={status}>{stateWord(status)}</StateChip>
      {problems.map((p) => (
        <span key={p.unionId} className="whitespace-nowrap text-body-sm font-medium text-seal">
          <span aria-hidden="true">{p.failed ? "✗" : "○"} </span>[{p.tag ?? p.unionId}]{" "}
          {p.failed ? t.problems.tag.failed : t.problems.tag.stale}
        </span>
      ))}
      {deadline && (
        <Chip tone="seal" icon={<DroppedStitch />}>
          {t.deadline}
        </Chip>
      )}
    </span>
  );
}

/** Start, finish and duration; calls and quota; the error when it is not the deadline. */
function Facts({
  r,
  quota,
  clock,
}: {
  r: {
    startedAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    callsUsed: number;
    error: string | null;
    deadline: boolean;
  };
  quota: string | false;
  clock: Clock;
}) {
  const line = (parts: (string | false | null)[]) => (
    <span className="block">{parts.filter(Boolean).join(" · ")}</span>
  );
  return (
    <span className="text-body-sm tabular-nums text-ink/70 sm:flex-1">
      {line([
        fill(t.started, { at: clock.stamp(r.startedAt) }),
        r.finishedAt && fill(t.finished, { at: clock.hhmm(r.finishedAt) }),
        r.durationMs !== null && fill(t.seconds, { n: seconds(r.durationMs) }),
      ])}
      {line([fill(t.calls, { n: r.callsUsed }), quota])}
      {r.error && !r.deadline && <span className="block break-words text-seal">{r.error}</span>}
    </span>
  );
}

function Title({ children, note }: { children: ReactNode; note: string }) {
  return (
    <span className="flex min-w-0 flex-col sm:w-72">
      <span className="break-words font-semibold text-plum">{children}</span>
      <span className="text-body-sm">{note}</span>
    </span>
  );
}

export function SnapshotRunRow({ r, clock }: { r: SnapshotRun; clock: Clock }) {
  return (
    <Link href={`/admin/runs/${r.id}`} className={`tint-button ${ROW}`}>
      <Flags status={r.status} problems={r.problems} deadline={r.deadline} />
      <Title note={clock.stamp(r.eventAtUtc)}>
        {eventWord(r, clock)} · {phaseWord(r.phase)}
      </Title>
      <Facts
        r={r}
        quota={r.quotaRemainingAfter !== null && fill(t.quotaLeft, { n: r.quotaRemainingAfter })}
        clock={clock}
      />
    </Link>
  );
}

/** Not a link: a daily read has no run page (D60 keeps no log for it). */
export function DailyRunRow({ r, clock }: { r: DailyRun; clock: Clock }) {
  return (
    <div className={ROW}>
      <Flags status={r.status} problems={r.problems} deadline={r.deadline} />
      <Title note={clock.weekday(r.startedAt)}>{t.daily}</Title>
      <Facts
        r={r}
        quota={
          r.quotaRemainingBefore !== null && fill(t.quotaBefore, { n: r.quotaRemainingBefore })
        }
        clock={clock}
      />
    </div>
  );
}
