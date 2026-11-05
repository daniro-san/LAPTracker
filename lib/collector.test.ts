import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_UPSTREAM_CALLS, RUN_DEADLINE_MS, runSnapshot } from "./collector";
import {
  ago,
  EVENT_ID,
  fakeInternal,
  fakeV1,
  IDS,
  makeDeps,
  minutes,
  roster,
  rowsOf,
  T0,
} from "./collector.test-helpers";
import { NotLiveError, QuotaExhaustedError, UpstreamError } from "./sources/types";
import { ALLIANCES } from "../config/alliances";

const fresh = (id: number) => roster(id, ago(T0, minutes(2)));
const [FIRST, SECOND] = IDS as [number, number];

describe("runSnapshot", () => {
  it("completes with every roster fresh, one quota call plus one call per alliance", async () => {
    const v1 = fakeV1((id) =>
      roster(id, ago(T0, minutes(2)), {
        quota: { limit: 1000, used: 100 + (id % 7), remaining: 900 - (id % 7) },
      }),
    );
    const { deps, repo } = makeDeps(v1, fakeInternal(), []);

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    expect(summary).toMatchObject({ status: "complete", callsUsed: IDS.length + 1, error: null });
    expect(summary.quotaRemainingAfter).toBe(Math.min(...IDS.map((id) => 900 - (id % 7))));
    expect(repo.tables.events.get(EVENT_ID)?.allianceIds).toEqual(IDS);
    const stored = repo.tables.rows.get(summary.snapshotId) ?? [];
    expect(stored).toHaveLength(IDS.length);
    const first = stored.find((r) => r.row.unionId === FIRST);
    expect(first?.row).toMatchObject({
      source: "v1",
      isFresh: true,
      totalKills: 300,
      totalPower: 6_000_000,
      powerBoard: 5_000_000,
      killsBoard: 700,
    });
    expect(first?.members).toHaveLength(3);
    expect(first?.row.raw).toEqual({
      union_id: FIRST,
      badge_url: "u",
      members: [{ uid: 1, avatar_url: "u", x: 1 }],
    });
    expect(repo.tables.snapshots[0]?.result?.boardPulledAt).toEqual(ago(T0, minutes(240)));
    expect(repo.tables.snapshots[0]?.result?.quotaRemainingBefore).toBe(1000);
  });

  it("marks the snapshot partial and names the alliance when its roster updated_at is old", async () => {
    const v1 = fakeV1((id) => (id === SECOND ? roster(id, ago(T0, minutes(45))) : fresh(id)));
    const { deps } = makeDeps(v1);

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    expect(summary.status).toBe("partial");
    expect(summary.stale).toEqual([{ unionId: SECOND, tag: `T${SECOND % 1000}` }]);
  });

  it("stores the internal live roster with source internal when v1 fails", async () => {
    const v1 = fakeV1((id) => (id === FIRST ? new UpstreamError(503) : fresh(id)));
    const internal = fakeInternal(fresh);
    const { deps, repo } = makeDeps(v1, internal);

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    expect(internal.calls).toEqual([FIRST]);
    const row = rowsOf(repo, summary.snapshotId).find((r) => r.unionId === FIRST);
    expect(row).toMatchObject({ source: "internal", error: null, isFresh: true, totalKills: 300 });
    expect(summary.status).toBe("complete");
  });

  it("stores a row with the error and no members when v1 fails and internal is a stub", async () => {
    const v1 = fakeV1((id) => (id === FIRST ? new UpstreamError(503) : fresh(id)));
    const internal = fakeInternal(() => new NotLiveError("stub"));
    const { deps, repo } = makeDeps(v1, internal);

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    const stored = (repo.tables.rows.get(summary.snapshotId) ?? []).find(
      (r) => r.row.unionId === FIRST,
    );
    expect(stored?.row).toMatchObject({
      error: "v1 http 503; internal not live",
      isFresh: false,
      totalPower: null,
    });
    expect(stored?.members).toEqual([]);
    expect(summary.status).toBe("partial");
    expect(summary.failed).toEqual([
      { unionId: FIRST, tag: "NSE", error: "v1 http 503; internal not live" },
    ]);
  });

  it("stops on a 429 mid-run and finishes partial with the rows collected so far", async () => {
    const v1 = fakeV1((id, call) => (call === 8 ? new QuotaExhaustedError("429") : fresh(id)));
    const internal = fakeInternal(fresh);
    const { deps, repo } = makeDeps(v1, internal);

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    const rows = rowsOf(repo, summary.snapshotId);
    expect(summary).toMatchObject({ status: "partial", error: "quota exhausted (429)" });
    expect(rows).toHaveLength(v1.calls.length - 1);
    expect(v1.calls.length).toBeLessThan(IDS.length);
    expect(internal.calls).toEqual([]);
    const missing = IDS.filter((id) => !rows.some((r) => r.unionId === id));
    expect(missing.length).toBeGreaterThan(0);
    expect(summary.stale).toEqual([]);
    expect(summary.failed).toEqual(
      missing.map((id) => ({
        unionId: id,
        tag: ALLIANCES.find((a) => a.unionId === id)?.tag,
        error: "not fetched: quota exhausted (429)",
      })),
    );
  });

  it("fails an AFTER run on an event with no alliance list without a quota call", async () => {
    const v1 = fakeV1(fresh);
    const { deps, repo } = makeDeps(v1, fakeInternal(), []);

    const summary = await runSnapshot(EVENT_ID, "after", deps);

    expect(summary).toMatchObject({
      status: "failed",
      callsUsed: 0,
      error: "no alliance list on the event: BEFORE has not run",
    });
    expect(v1.calls).toEqual([]);
    expect(repo.tables.snapshots[0]?.result?.error).toBe(
      "no alliance list on the event: BEFORE has not run",
    );
  });

  it("aborts at MAX_UPSTREAM_CALLS even when every call succeeds", async () => {
    const many = Array.from({ length: 150 }, (_, i) => 70_000_000 + i);
    const v1 = fakeV1(fresh);
    const { deps, repo } = makeDeps(v1, fakeInternal(), many);

    const summary = await runSnapshot(EVENT_ID, "after", deps);

    expect(summary.callsUsed).toBe(MAX_UPSTREAM_CALLS);
    expect(v1.calls).toHaveLength(MAX_UPSTREAM_CALLS - 1);
    expect(rowsOf(repo, summary.snapshotId)).toHaveLength(MAX_UPSTREAM_CALLS - 1);
    expect(summary).toMatchObject({ status: "failed", error: "MAX_UPSTREAM_CALLS reached" });
  });

  it("leaves the snapshot running when an unexpected error is thrown", async () => {
    const { deps, repo } = makeDeps(fakeV1(fresh));
    repo.insertAllianceRow = async () => {
      throw new Error("db down");
    };

    await expect(runSnapshot(EVENT_ID, "before", deps)).rejects.toThrow("db down");

    expect(await repo.findSnapshot(EVENT_ID, "before")).toMatchObject({ status: "running" });
  });

  it("writes one v1.fetch line per /v1 call with its status, cache flag and duration", async () => {
    const v1 = fakeV1((id) => (id === FIRST ? new UpstreamError(503) : fresh(id)));
    const lines: { code: string; data: Record<string, unknown> }[] = [];
    const { deps } = makeDeps(v1);
    const record = async (code: string, data: Record<string, unknown> = {}) => {
      lines.push({ code, data });
    };

    const summary = await runSnapshot(EVENT_ID, "before", {
      ...deps,
      logger: { info: record, warn: record, error: record },
    });

    const fetches = lines.filter((l) => l.code === "v1.fetch");
    expect(fetches).toHaveLength(summary.callsUsed);
    expect(fetches.filter((l) => l.data.endpoint === "quota")).toHaveLength(1);
    expect(fetches.find((l) => l.data.union_id === FIRST)?.data).toMatchObject({
      endpoint: "alliance",
      http_status: 503,
    });
    expect(fetches.find((l) => l.data.union_id === SECOND)?.data).toEqual({
      endpoint: "alliance",
      union_id: SECOND,
      http_status: 200,
      cached: false,
      duration_ms: 0,
      quota_remaining: 900,
    });
  });
});

describe("runSnapshot deadline", () => {
  afterEach(() => vi.useRealTimers());

  const hangingV1 = () => {
    const v1 = fakeV1(fresh);
    v1.fetchAlliance = async (id, onAttempt) => {
      onAttempt?.(0);
      v1.calls.push(id);
      return new Promise(() => {});
    };
    return v1;
  };

  it("closes partial at the deadline when every read hangs, counting calls and naming every alliance", async () => {
    vi.useFakeTimers({ now: T0 });
    const v1 = hangingV1();
    const { deps, repo } = makeDeps(v1);
    deps.now = () => new Date();
    const lines: string[] = [];
    deps.logger = { ...deps.logger, warn: async (code) => void lines.push(code) };

    const run = runSnapshot(EVENT_ID, "before", deps);
    await vi.advanceTimersByTimeAsync(RUN_DEADLINE_MS + 1_000);
    const summary = await run;

    expect(summary).toMatchObject({ status: "partial", error: "deadline", callsUsed: 5 });
    expect(summary.durationMs).toBeLessThanOrEqual(RUN_DEADLINE_MS + 1_000);
    expect(summary.durationMs).toBeGreaterThanOrEqual(RUN_DEADLINE_MS);
    expect(summary.failed.map((f) => f.error)).toEqual(IDS.map(() => "not fetched: deadline"));
    expect(summary.failed.map((f) => f.unionId)).toEqual(IDS);
    expect(rowsOf(repo, summary.snapshotId)).toEqual([]);
    expect(lines.filter((c) => c === "run.deadline")).toHaveLength(1);
  });

  it("leaves a run that finishes in time unchanged", async () => {
    vi.useFakeTimers({ now: T0 });
    const { deps } = makeDeps(fakeV1((id) => roster(id, ago(T0, minutes(2)))));
    deps.now = () => new Date();

    const summary = await runSnapshot(EVENT_ID, "before", deps);
    await vi.advanceTimersByTimeAsync(RUN_DEADLINE_MS * 2);

    expect(summary).toMatchObject({ status: "complete", callsUsed: IDS.length + 1, error: null });
    expect(summary.failed).toEqual([]);
  });
});
