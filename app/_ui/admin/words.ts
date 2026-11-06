// The admin area names snapshots and run states with one set of words, the public pages' where they
// exist (07c S1, S3b): "Before snapshot", "done", "partly done", "failed".
import type { Clock } from "@/app/_ui/format";
import { copy, fill } from "@/lib/copy";
import type { ManualEventStatus } from "@/lib/queries/admin";

import type { RoundView } from "./actions";

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
): string => (r.isTest ? `${copy.admin.runs.rehearsal} ${clock.stamp(r.eventAtUtc)}` : r.eventName);

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
  const text = (p: ManualEventStatus["phases"][number]): string => {
    if (p.status === "running") return fill(ps.running, { at: clock.at(p.startedAt) });
    if (p.status === "failed") return fill(ps.failed, { reason: p.error ?? stateWord(p.status) });
    const at = clock.at(p.finishedAt ?? p.startedAt);
    return fill(p.status === "partial" ? ps.partial : ps.complete, { at });
  };
  return {
    id: manual.id,
    name: manual.name,
    visibility: manual.visibility,
    postPublic: manual.postPublic,
    calls: manual.phases.reduce((n, p) => n + p.callsUsed, 0),
    phases: manual.phases.map((p) => ({ phase: p.phase, status: p.status, text: text(p) })),
  };
}
