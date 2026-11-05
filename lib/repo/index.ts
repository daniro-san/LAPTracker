// Persistence: one module per table, plain functions over Drizzle. No generic repository (plan §11.1).
// `Repo` is the collector's view of them (Deps.repo); lib/repo/memory.ts implements it for tests.
import type { Db } from "../db";
import { clearAllianceRows, insertAllianceRow, listAllianceRows } from "./alliance-snapshots";
import { getEvent, setEventAllianceIds } from "./events";
import { findSnapshot, finishSnapshot, startSnapshot } from "./snapshots";

export type Phase = "before" | "after";
export type SnapshotStatus = "running" | "complete" | "partial" | "failed";

export interface EventRow {
  id: number;
  allianceIds: number[];
}

export interface SnapshotRow {
  id: number;
  status: SnapshotStatus;
  startedAt: Date;
}

/** One alliance_snapshots row. Data fields are null only on an error row. */
export interface AllianceRow {
  unionId: number;
  tag: string | null;
  name: string | null;
  memberCount: number | null;
  /** Absent on an error row and on rows the internal source made. */
  capacity?: number | null;
  totalPower: number | null;
  totalKills: number | null;
  serverRank: number | null;
  level: number | null;
  /** Absent on an error row. */
  badgeId?: number | null;
  powerBoard: number | null;
  killsBoard: number | null;
  source: "v1" | "internal";
  sourceUpdatedAt: Date | null;
  cached: boolean | null;
  isFresh: boolean;
  error: string | null;
  raw: unknown;
}

export interface MemberRow {
  uid: number;
  name: string;
  power: number | null;
  kills: number | null;
  lv: number | null;
  avatarUrl?: string | null;
  rankCode?: number | null;
  rankLabel?: string | null;
}

/** What the collector reads back to decide the status and the re-run set. */
export type AllianceRowStatus = Pick<AllianceRow, "unionId" | "tag" | "isFresh" | "error">;

export interface SnapshotResult {
  status: Exclude<SnapshotStatus, "running">;
  finishedAt: Date;
  /** Added to the stored calls_used, so a re-run keeps the snapshot's whole quota cost. */
  callsUsed: number;
  /** The quota check's `remaining`; null when the check failed. */
  quotaRemainingBefore: number | null;
  quotaRemainingAfter: number | null;
  /** Attempts after the one that gave quotaRemainingAfter; overwritten like the quota columns. */
  quotaUnseenCalls: number;
  boardPulledAt: Date | null;
  error: string | null;
  durationMs: number;
}

export interface Repo {
  getEvent(eventId: number): Promise<EventRow | null>;
  setEventAllianceIds(eventId: number, ids: number[]): Promise<void>;
  findSnapshot(eventId: number, phase: Phase): Promise<SnapshotRow | null>;
  /**
   * Compare-and-set claim: inserts a running snapshot when `expected` is null, else restarts the
   * row only if it still equals `expected`. Returns the id, or null when another run got there first.
   */
  startSnapshot(
    eventId: number,
    phase: Phase,
    startedAt: Date,
    expected: SnapshotRow | null,
  ): Promise<number | null>;
  clearAllianceRows(snapshotId: number): Promise<void>;
  listAllianceRows(snapshotId: number): Promise<AllianceRowStatus[]>;
  /** The row and its members in one transaction. */
  insertAllianceRow(snapshotId: number, row: AllianceRow, members: MemberRow[]): Promise<void>;
  finishSnapshot(snapshotId: number, result: SnapshotResult): Promise<void>;
}

export function createRepo(db: Db): Repo {
  return {
    getEvent: (id) => getEvent(db, id),
    setEventAllianceIds: (id, ids) => setEventAllianceIds(db, id, ids),
    findSnapshot: (eventId, phase) => findSnapshot(db, eventId, phase),
    startSnapshot: (eventId, phase, startedAt, expected) =>
      startSnapshot(db, eventId, phase, startedAt, expected),
    clearAllianceRows: (id) => clearAllianceRows(db, id),
    listAllianceRows: (id) => listAllianceRows(db, id),
    insertAllianceRow: (id, row, members) => insertAllianceRow(db, id, row, members),
    finishSnapshot: (id, result) => finishSnapshot(db, id, result),
  };
}
