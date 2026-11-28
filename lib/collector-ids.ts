// The run's alliances and the ranks board (plan Phase 3, D133), split from lib/collector.ts for size: a
// Before copies the newest tracked set onto its event; an After and a sample read that copy. The board is a
// cross-check of a Before and an After (§3.5).
import { SERVER, TRACKED_COUNT } from "../config/alliances";
import type { Deps } from "./collector";
import { RunRefusedError } from "./collector-claim";
import { topByPower } from "./compute";
import type { SnapshotPhase } from "./repo";
import type { RanksBoard } from "./sources/types";
import { describe } from "./upstream-errors";

export async function allianceIds(
  deps: Deps,
  eventId: number,
  phase: SnapshotPhase,
  window = 1,
): Promise<number[]> {
  const event = await deps.repo.getEvent(eventId);
  if (!event) throw new RunRefusedError("no-event");
  // INVARIANT event.after-uses-event-copy: BEFORE copies the newest tracked set (D133); AFTER, a sample and
  // a later window's Before (D160: every window reads the same alliances) never read it.
  if (phase !== "before" || window > 1) return event.allianceIds;
  // With no set and no earlier event yet (a new database), the board's top TRACKED_COUNT now.
  let ids = await deps.repo.trackedAllianceIds();
  if (ids.length === 0) {
    const board = await fetchBoard(deps);
    ids = board ? topByPower(board.power, TRACKED_COUNT) : [];
  }
  await deps.repo.setEventAllianceIds(eventId, ids);
  return ids;
}

export async function fetchBoard(deps: Deps): Promise<RanksBoard | null> {
  try {
    return await deps.internal.fetchRanks(SERVER);
  } catch (e) {
    // The board is a cross-check only (§3.5): its failure never changes the status.
    await deps.logger.warn("board.failed", { error: describe(e) });
    return null;
  }
}
