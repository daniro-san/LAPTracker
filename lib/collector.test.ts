import { describe, expect, it } from "vitest";

import { MAX_UPSTREAM_CALLS, runSnapshot } from "./collector";
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
    expect(first?.row.raw).toEqual({ union_id: FIRST, members: [{ uid: 1, x: 1 }] });
    expect(repo.tables.snapshots[0]?.result?.boardPulledAt).toEqual(ago(T0, minutes(240)));
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
});
