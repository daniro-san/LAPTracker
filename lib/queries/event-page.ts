// Everything the comparison page reads, in one call per page (plan Phase 5): the event, the
// selector's events, joined/left counts per alliance, ledger ranks, who gained kills, kill share vs might share, every alliance's
// name history and the previous event's totals (issue 473).
import { windowedStartRows } from "../compute";
import type { Db } from "../db";
import { whoCarried } from "./carried";
import {
  getEventDetail,
  homeEvent,
  listEvents,
  previousEventTotals,
  type EventSummary,
} from "./events";
import { eventMatchup } from "./kvk";
import { allianceMovers, memberMovers } from "./movers";
import { allianceNames } from "./names";
import { eventRanks } from "./ranks";
import { rosterChanges, type RosterChange } from "./rosters";
import { memberTurnout, memberTurnoutSoFar } from "./turnout";

/** The page's reads of one event, shared between requests (the page passes the public cache, D143): `key`
 * is the event's id and the section flags. `load` gets the connection to read with: a shared read can run
 * after this request's connection is closed. */
type Shared = <T>(
  key: [number, boolean, boolean, boolean],
  load: (db: Db) => Promise<T>,
) => Promise<T>;

type Phases = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;

/** Who gained kills: Start against End, or while there is no End, against each alliance's latest sample
 * (#307). */
function turnoutOf(db: Db, id: number, { snapshots, between }: Phases) {
  const before = snapshots.find((s) => s.phase === "before");
  if (snapshots.some((s) => s.phase === "after")) return memberTurnout(db, snapshots, between);
  return before ? memberTurnoutSoFar(db, id, before.id) : null;
}

/** Which war sections the page reads (their flags, D91); one left out is null and its rows are never read. */
interface Sections {
  turnout: boolean;
  carried: boolean;
  /** The KvK matchup (D152). */
  matchup?: boolean;
}

/**
 * What the page reads about one event; null for no such (public) event. War turnout and kill share vs might
 * share only while their flags are on; kill share vs might share takes each row's "with kills" figure from
 * the turnout, so without the turnout it has none. The Maps go as their entries, so the value is JSON.
 */
async function eventReads(db: Db, id: number, sections: Sections) {
  const detail = await getEventDetail(db, id);
  if (!detail) return null;
  const before = detail.snapshots.find((s) => s.phase === "before");
  const after = detail.snapshots.find((s) => s.phase === "after");
  const unionIds = [...new Set(detail.snapshots.flatMap((s) => s.alliances.map((a) => a.unionId)))];
  const turnoutRead = Promise.resolve(sections.turnout ? turnoutOf(db, id, detail) : null);
  const [names, ranks, changes, members, turnout, carried, previous, matchup] = await Promise.all([
    allianceNames(db, unionIds),
    eventRanks(db, id),
    before && after
      ? rosterChanges(db, id, { before: before.id, after: after.id })
      : Promise.resolve(new Map<number, RosterChange>()),
    memberMovers(db, detail.snapshots, undefined, detail.between),
    turnoutRead,
    sections.carried ? whoCarried(db, detail, turnoutRead) : null,
    previousEventTotals(db, detail),
    sections.matchup ? eventMatchup(db, id) : null,
  ]);
  return {
    detail,
    names: [...names],
    ranks: [...ranks],
    changes: [...changes],
    members,
    turnout,
    carried,
    previous,
    matchup,
  };
}

/** The selector's events, the home event and the page's event: `eventId`, else the home event. */
async function whichEvent(
  listed: Promise<EventSummary[]>,
  eventId: number | null,
  windowMin: number,
) {
  const events = await listed;
  const homeId = homeEvent(events, new Date(), windowMin)?.id ?? null;
  return { events, homeId, id: eventId ?? homeId };
}

/**
 * `eventId` null = the home page's event (`homeEvent`, per request: it depends on `now`). Null page: no such
 * (public) event. `shared` keeps the event's reads for every viewer; by default it reads every time.
 * `windowMin` is SNAPSHOT_WINDOW_MIN, for `homeEvent`. `sections`: which war sections are read; it may still
 * be on its way, so the flags are read while the event list is. `listed`: the event list (the page passes the
 * shared one, D143).
 */
export async function getEventPage(
  db: Db,
  eventId: number | null,
  windowMin: number,
  shared: Shared = (_key, load) => load(db),
  sections: Sections | PromiseLike<Sections> = { turnout: true, carried: true },
  listed: () => Promise<EventSummary[]> = () => listEvents(db),
) {
  const { events, homeId, id } = await whichEvent(listed(), eventId, windowMin);
  // The list holds every public event (the same `publicEvent` filter as getEventDetail): an id not in it is
  // never read, so a crawl of made-up ids costs nothing.
  if (id === null || !events.some((e) => e.id === id)) return { events, homeId, page: null };
  const on = await sections;
  const read = await shared([id, on.turnout, on.carried, on.matchup === true], (own) =>
    eventReads(own, id, on),
  );
  if (!read) return { events, homeId, page: null };
  const { detail, members, turnout, carried, matchup } = read;
  const ranks = new Map(read.ranks);
  const before = detail.snapshots.find((s) => s.phase === "before");
  const after = detail.snapshots.find((s) => s.phase === "after");
  // D160: an alliance's change is the sum of its windows' changes.
  const changeFrom = before && windowedStartRows(before.alliances, detail.between ?? []);
  const movers = {
    alliances: changeFrom && after ? allianceMovers(changeFrom, after.alliances, ranks) : null,
    members,
  };
  const names = new Map(read.names);
  const changes = new Map(read.changes);
  const previous = read.previous && { at: read.previous.at, rows: new Map(read.previous.rows) };
  return {
    events,
    homeId,
    page: { detail, names, ranks, changes, movers, turnout, carried, previous, matchup },
  };
}
