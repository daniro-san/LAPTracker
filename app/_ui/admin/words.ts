// The admin area names snapshots and run states with one set of words, the public pages' where they
// exist (07c S1, S3b): "Before snapshot", "done", "partly done", "failed".
import { copy } from "@/lib/copy";

export const phaseWord = (phase: "before" | "after"): string => copy.admin.phase[phase];

const STATE: Record<string, string> = {
  complete: copy.status.done,
  partial: copy.status.partial,
  failed: copy.status.failed,
  running: copy.admin.running,
};

/** A snapshot's status column in words; an unknown value is shown as stored. */
export const stateWord = (status: string): string => STATE[status] ?? status;
