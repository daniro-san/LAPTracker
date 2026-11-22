// /admin's KvK opponent card (D152): the next scheduled event and the 4 before it, each with its opponent and
// what the Start and End read of each tag. Admin only: the result and the error rows stay here.
import type { Db } from "../db";
import { kvkEventTimes, opponentReads, opponentsAt } from "../repo/kvk";

export async function adminKvk(db: Db, next: Date) {
  const times = await kvkEventTimes(db, next);
  const opponents = await opponentsAt(db, times);
  const reads = await opponentReads(
    db,
    opponents.map((o) => o.id),
  );
  return times.map((at) => {
    const opponent = opponents.find((o) => o.eventAt.getTime() === at.getTime()) ?? null;
    return { at, opponent, reads: reads.filter((r) => r.opponentId === opponent?.id) };
  });
}

export type AdminKvkRead = Awaited<ReturnType<typeof adminKvk>>[number]["reads"][number];
