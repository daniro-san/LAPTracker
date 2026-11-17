// Everything the comparison page reads, in one call per page (plan Phase 5): the event, the
// selector's events, joined/left counts per alliance, ledger ranks, who gained kills, kill share vs might share and every alliance's
// name history.
import type { Db } from "../db";
import { whoCarried } from "./carried";
import { getEventDetail, homeEvent, listEvents } from "./events";
import { allianceMovers, memberMovers } from "./movers";
import { allianceNames } from "./names";
import { eventRanks } from "./ranks";
import { rosterChanges, type RosterChange } from "./rosters";
import { memberTurnout, memberTurnoutSoFar } from "./turnout";

/** A read shared between requests for one event (the page passes the event cache, issue 327). `load` gets
 * the connection to read with: a shared read can run after this request's connection is closed. */
type Shared = <T>(eventId: number, load: (db: Db) => Promise<T>) => Promise<T>;

type Phases = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;

/** Who gained kills: Start against End, or while there is no End, against each alliance's latest sample
 * (#307), shared between requests. */
function turnoutOf(db: Db, id: number, snapshots: Phases["snapshots"], shared: Shared) {
  const before = snapshots.find((s) => s.phase === "before");
  if (snapshots.some((s) => s.phase === "after")) return memberTurnout(db, snapshots);
  return before ? shared(id, (read) => memberTurnoutSoFar(read, id, before.id)) : null;
}

/** Which war sections the page reads (their flags, D91); one left out is null and its rows are never read. */
interface Sections {
  turnout: boolean;
  carried: boolean;
}

/** War turnout and kill share vs might share, as reads on their way. Kill share vs might share takes each
 * row's "with kills" figure from the turnout, so without the turnout it has none. */
function warReads(db: Db, id: number, detail: Phases, shared: Shared, sections: Sections) {
  const turnout = Promise.resolve(
    sections.turnout ? turnoutOf(db, id, detail.snapshots, shared) : null,
  );
  return [turnout, sections.carried ? whoCarried(db, detail, turnout) : null] as const;
}

/**
 * `eventId` null = the home page's event (`homeEvent`). Null page: no such (public) event. `shared` keeps
 * the turnout so far (no End yet) for every viewer; by default it reads every time. `windowMin` is
 * SNAPSHOT_WINDOW_MIN, for `homeEvent`. `sections`: which war sections are read.
 */
export async function getEventPage(
  db: Db,
  eventId: number | null,
  windowMin: number,
  shared: Shared = (_id, load) => load(db),
  sections: Sections = { turnout: true, carried: true },
) {
  const events = await listEvents(db);
  const homeId = homeEvent(events, new Date(), windowMin)?.id ?? null;
  const id = eventId ?? homeId;
  if (id === null) return { events, homeId, page: null };
  const detail = await getEventDetail(db, id);
  if (!detail) return { events, homeId, page: null };
  const before = detail.snapshots.find((s) => s.phase === "before");
  const after = detail.snapshots.find((s) => s.phase === "after");
  const unionIds = [...new Set(detail.snapshots.flatMap((s) => s.alliances.map((a) => a.unionId)))];
  const [turnoutRead, carriedRead] = warReads(db, id, detail, shared, sections);
  const [names, ranks, changes, members, turnout, carried] = await Promise.all([
    allianceNames(db, unionIds),
    eventRanks(db, id),
    before && after
      ? rosterChanges(db, { before: before.id, after: after.id })
      : Promise.resolve(new Map<number, RosterChange>()),
    memberMovers(db, detail.snapshots),
    turnoutRead,
    carriedRead,
  ]);
  const movers = {
    alliances: before && after ? allianceMovers(before.alliances, after.alliances, ranks) : null,
    members,
  };
  return { events, homeId, page: { detail, names, ranks, changes, movers, turnout, carried } };
}
