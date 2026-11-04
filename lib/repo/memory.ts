// In-memory Repo with the same semantics as the Drizzle one (claim is compare-and-set, unique
// (snapshot, union_id), calls_used accumulates). Used by collector tests and `pnpm snapshot:dry`.
import type {
  AllianceRow,
  EventRow,
  MemberRow,
  Phase,
  Repo,
  SnapshotResult,
  SnapshotRow,
} from "./index";

interface StoredSnapshot extends SnapshotRow {
  eventId: number;
  phase: Phase;
  result: SnapshotResult | null;
  callsUsed: number;
}

export interface MemoryTables {
  events: Map<number, EventRow>;
  snapshots: StoredSnapshot[];
  rows: Map<number, { row: AllianceRow; members: MemberRow[] }[]>;
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

export function createMemoryRepo(seedEvents: EventRow[] = []): Repo & { tables: MemoryTables } {
  const tables: MemoryTables = {
    events: new Map(seedEvents.map((e) => [e.id, { ...e }])),
    snapshots: [],
    rows: new Map(),
  };
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
    clearAllianceRows: async (id) => {
      tables.rows.delete(id);
    },
    listAllianceRows: async (id) =>
      rowsOf(id).map(({ row }) => ({
        unionId: row.unionId,
        tag: row.tag,
        isFresh: row.isFresh,
        error: row.error,
      })),
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
  };
}
