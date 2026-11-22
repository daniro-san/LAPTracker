// Persistence: one module per table, plain functions over Drizzle. No generic repository (plan §11.1).
// `Repo` is the collector's view of them (Deps.repo); lib/repo/memory.ts implements it for tests.
import type { Db } from "../db";
import {
  clearAllianceRows,
  clearFailedAllianceRows,
  failedSampleUnionIds,
  insertAllianceRow,
  insertSampleRow,
  listAllianceRows,
} from "./alliance-snapshots";
import { allianceLabels, trackedAllianceIds } from "./alliances";
import { lastMemberUids } from "./daily-reads";
import { getEvent, setEventAllianceIds } from "./events";
import {
  insertOpponentRead,
  opponentFor,
  opponentReads,
  type OpponentInfo,
  type OpponentRead,
} from "./kvk";
import { findSnapshot, finishSnapshot, startSample, startSnapshot } from "./snapshots";

export type Phase = "before" | "after";
/** A snapshots row's phase: a Before, an After, or a sample between them (D69). */
export type SnapshotPhase = Phase | "sample";
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
  frameId?: number | null;
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
  /** A sample's claim (D69): inserts a running row for (event, slot), or null when the slot is taken. */
  startSample(eventId: number, slotAt: Date, startedAt: Date): Promise<number | null>;
  /** The alliances whose read failed in any sample of the event (D69). */
  failedSampleUnionIds(eventId: number): Promise<number[]>;
  clearAllianceRows(snapshotId: number): Promise<void>;
  /** The rows with an error (D62), and with `stale` every stale row too (D63): a re-run reads them again. */
  clearFailedAllianceRows(snapshotId: number, stale: boolean): Promise<void>;
  listAllianceRows(snapshotId: number): Promise<AllianceRowStatus[]>;
  /** The row and its members in one transaction. */
  insertAllianceRow(snapshotId: number, row: AllianceRow, members: MemberRow[]): Promise<void>;
  /** A sample's row (D69): the members as arrays on the row, no member rows, no raw_json. */
  insertSampleRow(snapshotId: number, row: AllianceRow, members: MemberRow[]): Promise<void>;
  finishSnapshot(snapshotId: number, result: SnapshotResult): Promise<void>;
  /** The alliances a Before copies onto its event: the newest tracked set (D133). */
  trackedAllianceIds(): Promise<number[]>;
  /** The newest tag and name of each id that has one (D133). */
  allianceLabels(ids: number[]): Promise<Map<number, { tag: string | null; name: string | null }>>;
  /** Each id's uids in its newest daily roster (D60); ids with none are left out. */
  lastMemberUids(ids: number[]): Promise<Map<number, number[]>>;
  /** The KvK opponent of a scheduled event (D152); null for any other event or none saved. */
  opponentFor(eventId: number): Promise<OpponentInfo | null>;
  /** The opponent's rows so far, both phases. */
  opponentReads(opponentId: number): Promise<OpponentRead[]>;
  insertOpponentRead(row: OpponentRead): Promise<void>;
}

export type { OpponentInfo, OpponentRead };

export function createRepo(db: Db): Repo {
  return {
    getEvent: (id) => getEvent(db, id),
    setEventAllianceIds: (id, ids) => setEventAllianceIds(db, id, ids),
    findSnapshot: (eventId, phase) => findSnapshot(db, eventId, phase),
    startSnapshot: (eventId, phase, startedAt, expected) =>
      startSnapshot(db, eventId, phase, startedAt, expected),
    startSample: (eventId, slotAt, startedAt) => startSample(db, eventId, slotAt, startedAt),
    failedSampleUnionIds: (eventId) => failedSampleUnionIds(db, eventId),
    clearAllianceRows: (id) => clearAllianceRows(db, id),
    clearFailedAllianceRows: (id, stale) => clearFailedAllianceRows(db, id, stale),
    listAllianceRows: (id) => listAllianceRows(db, id),
    insertAllianceRow: (id, row, members) => insertAllianceRow(db, id, row, members),
    insertSampleRow: (id, row, members) => insertSampleRow(db, id, row, members),
    finishSnapshot: (id, result) => finishSnapshot(db, id, result),
    trackedAllianceIds: () => trackedAllianceIds(db),
    allianceLabels: (ids) => allianceLabels(db, ids),
    lastMemberUids: (ids) => lastMemberUids(db, ids),
    opponentFor: (eventId) => opponentFor(db, eventId),
    opponentReads: (id) => opponentReads(db, [id]),
    insertOpponentRead: (row) => insertOpponentRead(db, row),
  };
}
