// The collector's claim on a snapshot row (plan Phase 3): who may run it, and which rows a re-run
// drops before it reads (D62, D63). Split from lib/collector.ts, which re-exports RunRefusedError.
import { RUN_STALE_AFTER_MS } from "./compute";
import type { Phase, Repo, SnapshotRow } from "./repo";

/** The run did not start: the snapshot is complete (pass force), another run holds it, or it has
 * stale rows and the caller has not said whether to read them again (D63). */
export class RunRefusedError extends Error {
  override name = "RunRefusedError";
  constructor(
    readonly reason: "complete" | "running" | "no-event" | "stale",
    /** For "stale": how many rows are stale. */
    readonly staleCount?: number,
  ) {
    super(`snapshot run refused: ${reason}`);
  }
}

interface ClaimDeps {
  repo: Repo;
  now: () => Date;
}

/** D63: a re-run that has not said what to do with stale rows is refused while any exist, so the
 * caller asks first; reading them again costs a request each. A forced run reads everything anyway. */
async function refuseWhileStale(
  deps: ClaimDeps,
  existing: SnapshotRow | null,
  options: { force: boolean; stale: boolean | undefined },
): Promise<void> {
  if (!existing || options.force || options.stale !== undefined) return;
  const rows = await deps.repo.listAllianceRows(existing.id);
  const count = rows.filter((r) => !r.isFresh && r.error === null).length;
  if (count > 0) throw new RunRefusedError("stale", count);
}

/** `stale`: true reads the stale rows again, false keeps them, undefined refuses while any exist. */
export async function claim(
  deps: ClaimDeps,
  eventId: number,
  phase: Phase,
  options: { force: boolean; stale: boolean | undefined },
): Promise<number> {
  const { force, stale } = options;
  const existing: SnapshotRow | null = await deps.repo.findSnapshot(eventId, phase);
  const now = deps.now();
  if (existing?.status === "complete" && !force) throw new RunRefusedError("complete");
  // INVARIANT run.stale-after-150s: a run left at running this long may be taken over.
  const live = now.getTime() - (existing?.startedAt.getTime() ?? 0) < RUN_STALE_AFTER_MS;
  if (existing?.status === "running" && live) throw new RunRefusedError("running");
  await refuseWhileStale(deps, existing, options);
  const id = await deps.repo.startSnapshot(eventId, phase, now, existing);
  if (id === null) throw new RunRefusedError("running");
  // A forced run reads the whole snapshot again. Any other re-run (partial, failed, or left running)
  // drops the failed rows (D62), and the stale ones when asked (D63), and reads those alliances again.
  if (existing)
    await (force
      ? deps.repo.clearAllianceRows(id)
      : deps.repo.clearFailedAllianceRows(id, stale === true));
  return id;
}
