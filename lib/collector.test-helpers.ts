// Test-only fakes for the collector's Deps: v1 and internal sources, a settable clock, a silent logger.
import { ALLIANCES } from "../config/alliances";
import type { Deps } from "./collector";
import { sumKills, sumPower } from "./compute";
import type { Logger } from "./logger";
import { createMemoryRepo } from "./repo/memory";
import {
  type AllianceSnapshotInput,
  type InternalSource,
  NotLiveError,
  type OnAttempt,
  type V1Source,
} from "./sources/types";

export const T0 = new Date("2026-11-07T12:00:00Z");
export const EVENT_ID = 1;
export const IDS: number[] = ALLIANCES.map((a) => a.unionId);
export const minutes = (n: number) => n * 60_000;
export const ago = (now: Date, ms: number) => new Date(now.getTime() - ms);

/** A roster of 3 members whose totals are the member sums; raw carries the fields §6 trims. */
export function roster(
  unionId: number,
  updatedAt: Date | null,
  extra: Partial<AllianceSnapshotInput> = {},
): AllianceSnapshotInput {
  const members = [1, 2, 3].map((i) => ({
    uid: unionId * 10 + i,
    name: `m${i}`,
    power: 1_000_000 * i,
    kills: i === 3 ? null : 100 * i,
    lv: 30 + i,
  }));
  return {
    unionId,
    tag: `T${unionId % 1000}`,
    name: `Alliance ${unionId}`,
    memberCount: members.length,
    totalPower: sumPower(members),
    totalKills: sumKills(members),
    members,
    serverRank: 1,
    level: 10,
    sourceUpdatedAt: updatedAt,
    cached: false,
    quota: { limit: 1000, used: 100, remaining: 900 },
    raw: {
      union_id: unionId,
      bulletin: "free text",
      declaration: "free text",
      badge_url: "u",
      server_badge_url: "u",
      quota: {},
      members: [{ uid: 1, avatar_url: "u", frame_url: "u", x: 1 }],
    },
    ...extra,
  };
}

type Outcome = AllianceSnapshotInput | Error;

/** A /v1 fake: reports one attempt per call through onAttempt, as the real adapter does. */
export function fakeV1(alliance: (id: number, call: number) => Outcome, remaining = 1000) {
  const calls: number[] = [];
  const v1: V1Source & { calls: number[] } = {
    calls,
    fetchQuota: async (onAttempt?: OnAttempt) => {
      onAttempt?.(0);
      return { limit: 1000, used: 1000 - remaining, remaining };
    },
    fetchAlliance: async (id: number, onAttempt?: OnAttempt) => {
      onAttempt?.(0);
      calls.push(id);
      const outcome = alliance(id, calls.length);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
  return v1;
}

export function fakeInternal(alliance: (id: number) => Outcome = () => new NotLiveError("stub")) {
  const calls: number[] = [];
  const internal: InternalSource & { calls: number[] } = {
    calls,
    fetchRanks: async () => ({
      pulledAt: ago(T0, minutes(240)),
      power: new Map(IDS.map((id) => [id, 5_000_000])),
      kills: new Map(IDS.map((id) => [id, 700])),
    }),
    fetchAlliance: async (id: number) => {
      calls.push(id);
      const outcome = alliance(id);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
  return internal;
}

export const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

/** Deps around an in-memory repo seeded with one event; `clock.now` can be moved by the test. */
export function makeDeps(
  v1: V1Source,
  internal: InternalSource = fakeInternal(),
  allianceIds = IDS,
) {
  const clock = { now: T0 };
  const repo = createMemoryRepo([{ id: EVENT_ID, allianceIds }]);
  const deps: Deps = { v1, internal, repo, logger: silentLogger, now: () => clock.now };
  return { deps, repo, clock };
}

export const rowsOf = (repo: ReturnType<typeof createMemoryRepo>, snapshotId: number) =>
  (repo.tables.rows.get(snapshotId) ?? []).map((r) => r.row);
