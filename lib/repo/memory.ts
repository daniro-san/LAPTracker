// In-memory Repo with the same semantics as the Drizzle one (claim is compare-and-set, unique
// (snapshot, union_id), calls_used accumulates). Used by collector tests and `pnpm snapshot:dry`.
import type {
  AllianceRow,
  EventRow,
  MemberRow,
  OpponentInfo,
  OpponentRead,
  Phase,
  Repo,
  SnapshotPhase,
  SnapshotResult,
  SnapshotRow,
} from "./index";

interface StoredSnapshot extends SnapshotRow {
  eventId: number;
  phase: SnapshotPhase;
  /** A sample's slot (D69). */
  slotAt?: Date;
  result: SnapshotResult | null;
  callsUsed: number;
}

export interface MemoryTables {
  events: Map<number, EventRow>;
  snapshots: StoredSnapshot[];
  rows: Map<number, { row: AllianceRow; members: MemberRow[] }[]>;
  /** The KvK opponent per event id (D152), and its rows. */
  opponents: Map<number, OpponentInfo>;
  opponentReads: OpponentRead[];
}

function claim(
  tables: MemoryTables,
  next: { eventId: number; phase: Phase; startedAt: Date },
  expected: SnapshotRow | null,
): number | null {
  const current = tables.snapshots.find(
    (x) => x.eventId === next.eventId && x.phase === next.phase,
  );
  if (expected === null) {
    if (current) return null;
    const id = tables.snapshots.length + 1;
    tables.snapshots.push({ ...next, id, status: "running", result: null, callsUsed: 0 });
    return id;
  }
  const same =
    current?.id === expected.id &&
    current.status === expected.status &&
    current.startedAt.getTime() === expected.startedAt.getTime();
  if (!current || !same) return null;
  Object.assign(current, { status: "running", startedAt: next.startedAt, result: null });
  return current.id;
}

/** The KvK opponent's part of the Repo (D152); unique (opponent, phase, tag), as the table. */
const opponentMethods = (tables: MemoryTables) =>
  ({
    opponentFor: async (eventId) => tables.opponents.get(eventId) ?? null,
    opponentReads: async (id) => tables.opponentReads.filter((r) => r.opponentId === id),
    insertOpponentRead: async (row) => {
      const taken = tables.opponentReads.some(
        (r) => r.opponentId === row.opponentId && r.phase === row.phase && r.tag === row.tag,
      );
      if (!taken) tables.opponentReads.push(row);
    },
  }) satisfies Pick<Repo, "opponentFor" | "opponentReads" | "insertOpponentRead">;

/** The tables of a new repo; a test sets an event's opponent in `opponents` (D152). */
const newTables = (seedEvents: EventRow[]): MemoryTables => ({
  events: new Map(seedEvents.map((e) => [e.id, { ...e }])),
  snapshots: [],
  rows: new Map(),
  opponents: new Map(),
  opponentReads: [],
});

/** `tracked`: the tracked set a Before copies (D133); `labels`: the alliances' tags and names; `rosters`:
 * each alliance's newest daily roster uids. */
export function createMemoryRepo(
  seedEvents: EventRow[] = [],
  tracked: number[] = [],
  labels: Map<number, { tag: string | null; name: string | null }> = new Map(),
  rosters: Map<number, number[]> = new Map(),
): Repo & { tables: MemoryTables } {
  const tables = newTables(seedEvents);
  const snapshot = (id: number) => tables.snapshots.find((s) => s.id === id);
  const rowsOf = (id: number) => tables.rows.get(id) ?? [];

  return {
    tables,
    getEvent: async (id) => tables.events.get(id) ?? null,
    setEventAllianceIds: async (id, ids) => {
      const event = tables.events.get(id);
      if (event) event.allianceIds = [...ids];
    },
    findSnapshot: async (eventId, phase) => {
      const s = tables.snapshots.find((x) => x.eventId === eventId && x.phase === phase);
      return s ? { id: s.id, status: s.status, startedAt: s.startedAt } : null;
    },
    startSnapshot: async (eventId, phase, startedAt, expected) =>
      claim(tables, { eventId, phase, startedAt }, expected),
    failedSampleUnionIds: async (eventId) => [
      ...new Set(
        tables.snapshots
          .filter((s) => s.eventId === eventId && s.phase === "sample")
          .flatMap((s) => rowsOf(s.id).filter((r) => r.row.error !== null))
          .map((r) => r.row.unionId),
      ),
    ],
    clearAllianceRows: async (id) => void tables.rows.delete(id),
    clearFailedAllianceRows: async (id, stale) => {
      const kept = rowsOf(id).filter(({ row }) => row.error === null && (!stale || row.isFresh));
      tables.rows.set(id, kept);
    },
    listAllianceRows: async (id) =>
      rowsOf(id).map(({ row }) => ({
        unionId: row.unionId,
        tag: row.tag,
        isFresh: row.isFresh,
        error: row.error,
      })),
    startSample: async (eventId, slotAt, startedAt) => {
      const taken = tables.snapshots.some(
        (x) => x.eventId === eventId && x.slotAt?.getTime() === slotAt.getTime(),
      );
      if (taken) return null;
      const id = tables.snapshots.length + 1;
      const s = { id, eventId, phase: "sample", slotAt, startedAt, status: "running" } as const;
      tables.snapshots.push({ ...s, result: null, callsUsed: 0 });
      return id;
    },
    // The arrays are a storage form: the memory repo keeps the members as given, without raw.
    insertSampleRow: async (id, row, members) => {
      tables.rows.set(id, [...rowsOf(id), { row: { ...row, raw: null }, members }]);
    },
    insertAllianceRow: async (id, row, members) => {
      if (rowsOf(id).some((r) => r.row.unionId === row.unionId)) {
        throw new Error(`duplicate (snapshot_id, union_id) = (${id}, ${row.unionId})`);
      }
      tables.rows.set(id, [...rowsOf(id), { row, members }]);
    },
    finishSnapshot: async (id, result) => {
      const s = snapshot(id);
      if (!s) return;
      Object.assign(s, {
        status: result.status,
        result,
        callsUsed: s.callsUsed + result.callsUsed,
      });
    },
    trackedAllianceIds: async () => [...tracked],
    allianceLabels: async (ids) => new Map([...labels].filter(([id]) => ids.includes(id))),
    lastMemberUids: async (ids) => new Map([...rosters].filter(([id]) => ids.includes(id))),
    ...opponentMethods(tables),
  };
}
