// Everything the comparison page reads, in one call per page (plan Phase 5): the event, the
// selector's events, joined/left counts per alliance, ledger ranks and every alliance's name history.
import type { Db } from "../db";
import { getEventDetail, listEvents } from "./events";
import { allianceNames } from "./names";
import { eventRanks } from "./ranks";
import { rosterChanges, type RosterChange } from "./rosters";

/** `eventId` null = the most recent event. Null result: no such (public) event. */
export async function getEventPage(db: Db, eventId: number | null) {
  const events = await listEvents(db);
  // The home page (no id) shows the newest real event, never a manual round (D28).
  const id = eventId ?? (events.find((e) => !e.manual) ?? events[0])?.id;
  if (id === undefined) return { events, page: null };
  const detail = await getEventDetail(db, id);
  if (!detail) return { events, page: null };
  const before = detail.snapshots.find((s) => s.phase === "before");
  const after = detail.snapshots.find((s) => s.phase === "after");
  const unionIds = [...new Set(detail.snapshots.flatMap((s) => s.alliances.map((a) => a.unionId)))];
  const [names, ranks, changes] = await Promise.all([
    allianceNames(db, unionIds),
    eventRanks(db, id),
    before && after
      ? rosterChanges(db, { before: before.id, after: after.id })
      : Promise.resolve(new Map<number, RosterChange>()),
  ]);
  return { events, page: { detail, names, ranks, changes } };
}
