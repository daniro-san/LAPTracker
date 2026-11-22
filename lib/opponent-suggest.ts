// The KvK opponent's tags suggested from its server's ranks board (D155, issue 306): one read of the same
// internal board D133 reads for us, with the opponent's server number, from /admin only. It spends no quota.
// The 15 alliances with the most might are kept as tag, name and might; the owner confirms them on the card.
import { MAX_OPPONENT_TAGS } from "./budget";
import { topByPower } from "./compute";
import type { Db } from "./db";
import { opponentTag } from "./kvk";
import { claimSuggestion, finishSuggestion, opponentsAt, opponentWasRead } from "./repo/kvk";
import type { SuggestedAlliance } from "./schema-kvk";
import type { InternalSource, RanksBoard } from "./sources/types";
import { describe } from "./upstream-errors";

/**
 * The board's 15 alliances with the most might (a tie to the lower id), counting only those whose tag passes
 * the opponent tag rule, because the Start reads each by tag.
 */
export function suggestionOf(board: RanksBoard): SuggestedAlliance[] {
  const usable = new Map<number, SuggestedAlliance>();
  for (const [id, power] of board.power) {
    const label = board.labels.get(id);
    const tag = opponentTag.safeParse(label?.tag ?? "");
    if (tag.success) usable.set(id, { tag: tag.data, name: label?.name ?? null, power });
  }
  const top = topByPower(new Map([...usable].map(([id, a]) => [id, a.power])), MAX_OPPONENT_TAGS);
  return top.flatMap((id) => usable.get(id) ?? []);
}

export type SuggestOutcome = "read" | "failed" | "kept";
export type SuggestRefusal = "no_opponent" | "war_started" | "opponent_read";

/** The board's suggestion, or null when the answer is not the server asked for or has nothing to suggest. */
async function readBoard(
  internal: Pick<InternalSource, "fetchRanks">,
  server: number,
): Promise<{ alliances: SuggestedAlliance[]; pulledAt: Date } | null> {
  try {
    const board = await internal.fetchRanks(server);
    if (board.server !== server) {
      console.warn("kvk.suggest_failed", { code: "wrong server" });
      return null;
    }
    const alliances = suggestionOf(board);
    return alliances.length > 0 ? { alliances, pulledAt: board.pulledAt } : null;
  } catch (e) {
    // The error's class only: no body or URL leaves here.
    console.warn("kvk.suggest_failed", { code: describe(e) });
    return null;
  }
}

/**
 * Reads the saved opponent's server board once for the KvK at `eventAt` (D155). `retry` (the card's press)
 * may claim a failed row again; a save never does. `kept`: the claim was refused, so no call was made.
 */
export async function suggestTags(
  deps: { internal: Pick<InternalSource, "fetchRanks"> },
  db: Db,
  eventAt: Date,
  now: Date,
  retry: boolean,
): Promise<SuggestOutcome | SuggestRefusal> {
  const [o] = await opponentsAt(db, [eventAt]);
  if (!o) return "no_opponent";
  if (now >= eventAt) return "war_started";
  if (await opponentWasRead(db, o.id)) return "opponent_read";
  const key = { eventAt, server: o.server };
  // INVARIANT suggest.one-read-per-event-server, suggest.attempt-cap: the claim comes before the call.
  if (!(await claimSuggestion(db, key, now, retry))) return "kept";
  const read = await readBoard(deps.internal, o.server);
  await finishSuggestion(db, key, read, now);
  return read ? "read" : "failed";
}
