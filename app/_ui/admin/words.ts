// The admin area names snapshots and run states with one set of words, the public pages' where they
// exist (07c S1, S3b): "Before snapshot", "done", "partly done", "failed".
import type { Clock } from "@/app/_ui/format";
import { copy, fill } from "@/lib/copy";
import type { ManualEventStatus } from "@/lib/queries/admin";
import { isGeneratedName, type ScheduledEvent } from "@/lib/schedule";

import type { CurrentEventView, RoundView } from "./actions";

export const phaseWord = (phase: "before" | "after"): string => copy.admin.phase[phase];

const STATE: Record<string, string> = {
  complete: copy.status.done,
  partial: copy.status.partial,
  failed: copy.status.failed,
  running: copy.admin.running,
};

/** A snapshot's status column in words; an unknown value is shown as stored. */
export const stateWord = (status: string): string => STATE[status] ?? status;

/** A run duration in milliseconds as seconds with one decimal: 9_866 → "9.9". */
export const seconds = (ms: number): string => (ms / 1000).toFixed(1);

/** An event in words: its name (any public event can be renamed, D39); a rehearsal, which keeps its
 * system name, as `[rehearsal]` and its time. */
export const eventWord = (
  r: { isTest: boolean; eventName: string; eventAtUtc: Date },
  clock: Clock,
): string => {
  if (r.isTest) return `${copy.admin.runs.rehearsal} ${clock.stamp(r.eventAtUtc)}`;
  // A generated name ("Saturday Event 2026-11-14") says its date once, in the viewer's order.
  return isGeneratedName(r.eventName) ? clock.weekday(r.eventAtUtc) : r.eventName;
};

/** What AdminShell's poller and /admin's notice need about the runs in progress and the newest run. */
export function watchViews(
  running: readonly {
    phase: "before" | "after";
    isTest: boolean;
    eventName: string;
    eventAtUtc: Date;
    startedAt: Date;
  }[],
  last:
    | {
        phase: "before" | "after";
        status: string;
        isTest: boolean;
        eventName: string;
        eventAtUtc: Date;
      }
    | undefined,
  clock: Clock,
) {
  return {
    running: running.map((r) => ({
      phase: phaseWord(r.phase),
      event: eventWord(r, clock),
      startedText: clock.stamp(r.startedAt),
    })),
    latest: last ? { event: eventWord(last, clock), phase: last.phase, status: last.status } : null,
  };
}

/** The newest manual round for its card: each phase's state in words with its time (#91 item 7). */
export function roundView(manual: ManualEventStatus, clock: Clock): RoundView {
  const ps = copy.admin.manual.phaseState;
  const at = (p: ManualEventStatus["phases"][number]): string =>
    clock.at(p.status === "running" ? p.startedAt : (p.finishedAt ?? p.startedAt));
  const text = (p: ManualEventStatus["phases"][number]): string => {
    if (p.status === "running") return fill(ps.running, { at: at(p) });
    if (p.status === "failed") return fill(ps.failed, { reason: p.error ?? stateWord(p.status) });
    return fill(p.status === "partial" ? ps.partial : ps.complete, { at: at(p) });
  };
  return {
    id: manual.id,
    name: manual.name,
    visibility: manual.visibility,
    postPublic: manual.postPublic,
    calls: manual.phases.reduce((n, p) => n + p.callsUsed, 0),
    phases: manual.phases.map((p) => ({
      phase: p.phase,
      status: p.status,
      text: text(p),
      at: at(p),
    })),
  };
}

const DAY_MS = 24 * 60 * 60_000;
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "Sat 07/11 · 3 days ago · both snapshots done": the target event's date, age and the state of its
 * two snapshots. */
export function targetText(
  eventAt: Date,
  phases: { phase: "before" | "after"; status: string }[],
  now: Date,
  clock: Clock,
): string {
  const state = (p: "before" | "after") =>
    fill(copy.admin.run.phaseState, {
      phase: copy.admin.seal[p],
      state: phases.find((x) => x.phase === p)?.status
        ? stateWord(phases.find((x) => x.phase === p)?.status as string)
        : copy.admin.run.notTaken,
    });
  const bothDone = (["before", "after"] as const).every(
    (p) => phases.find((x) => x.phase === p)?.status === "complete",
  );
  return fill(copy.admin.run.target, {
    date: clock.weekday(eventAt),
    age: relative.format(Math.round((eventAt.getTime() - now.getTime()) / DAY_MS), "day"),
    state: bothDone ? copy.admin.run.bothDone : `${state("before")}, ${state("after")}`,
  });
}

/** The target event as `AdminActions` shows it. */
export function currentView(
  current: ScheduledEvent,
  row: { id: number; name: string; phases: { phase: "before" | "after"; status: string }[] } | null,
  now: Date,
  clock: Clock,
): CurrentEventView {
  const name = row?.name ?? current.name;
  const rowFrom = new Date(current.beforeAt.getTime() - DAY_MS);
  return {
    id: row?.id ?? null,
    name,
    title: name.replace(/ \d{4}-\d{2}-\d{2}$/, ""),
    stateText: targetText(current.eventAtUtc, row?.phases ?? [], now, clock),
    rowFromText: rowFrom > now ? clock.stamp(rowFrom) : null,
  };
}
