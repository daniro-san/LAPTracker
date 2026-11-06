// Freshness is the guarantee this tool exists for (plan §3.7): written before lib/collector.ts.
import { describe, expect, it } from "vitest";

import { RunRefusedError, runSnapshot } from "./collector";
import {
  ago,
  EVENT_ID,
  fakeV1,
  IDS,
  makeDeps,
  minutes,
  roster,
  rowsOf,
  T0,
} from "./collector.test-helpers";
import { delta } from "./compute";
import { QuotaExhaustedError } from "./sources/types";

const [STALE_ID, EDGE_ID] = IDS as [number, number];

describe("freshness", () => {
  it("records a row older than 20 minutes as is_fresh=false and makes the snapshot partial", async () => {
    const v1 = fakeV1((id) => {
      if (id === STALE_ID) return roster(id, ago(T0, minutes(20) + 1));
      if (id === EDGE_ID) return roster(id, ago(T0, minutes(20)));
      return roster(id, ago(T0, minutes(1)));
    });
    const { deps, repo } = makeDeps(v1);

    const summary = await runSnapshot(EVENT_ID, "before", deps);

    const rows = rowsOf(repo, summary.snapshotId);
    expect(rows.find((r) => r.unionId === STALE_ID)?.isFresh).toBe(false);
    expect(rows.find((r) => r.unionId === EDGE_ID)?.isFresh).toBe(true);
    expect(rows.filter((r) => r.isFresh)).toHaveLength(IDS.length - 1);
    expect(summary.status).toBe("partial");
  });

  it("never yields a delta for a stale row", async () => {
    const after = new Date(T0.getTime() + minutes(240));
    const v1 = fakeV1((id, call) => {
      const isAfterRun = call > IDS.length;
      const now = isAfterRun ? after : T0;
      // In the AFTER run the stale alliance returns the BEFORE roster unchanged.
      const updatedAt = isAfterRun && id === STALE_ID ? T0 : ago(now, minutes(1));
      return roster(id, updatedAt, isAfterRun ? { totalPower: 99_000_000, totalKills: 9_999 } : {});
    });
    const { deps, repo, clock } = makeDeps(v1);
    const before = await runSnapshot(EVENT_ID, "before", deps);
    clock.now = after;
    const afterRun = await runSnapshot(EVENT_ID, "after", deps);

    const pairs = IDS.map((id) => [
      rowsOf(repo, before.snapshotId).find((r) => r.unionId === id),
      rowsOf(repo, afterRun.snapshotId).find((r) => r.unionId === id),
    ]);
    const deltas = new Map(
      IDS.map((id, i) => {
        const [b, a] = pairs[i] ?? [];
        if (!b || !a) throw new Error(`missing row for ${id}`);
        return [id, delta(b, a)];
      }),
    );
    expect(deltas.get(STALE_ID)).toBeNull();
    expect([...deltas.values()].filter((d) => d === null)).toHaveLength(1);
    expect(afterRun.status).toBe("partial");
  });

  it("re-runs a snapshot left running for more than 150 s without force, and refuses one started less than 150 s ago", async () => {
    const { deps, repo, clock } = makeDeps(fakeV1((id) => roster(id, ago(clock.now, 0))));
    const insert = repo.insertAllianceRow;
    repo.insertAllianceRow = async () => {
      throw new Error("db down");
    };
    await expect(runSnapshot(EVENT_ID, "before", deps)).rejects.toThrow("db down");
    repo.insertAllianceRow = insert;

    clock.now = new Date(T0.getTime() + 149_000);
    const refused = await runSnapshot(EVENT_ID, "before", deps).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(RunRefusedError);
    expect(refused).toMatchObject({ reason: "running" });

    clock.now = new Date(T0.getTime() + 151_000);
    const summary = await runSnapshot(EVENT_ID, "before", deps);
    expect(summary.status).toBe("complete");
  });

  it("re-runs fetch only alliances with no row", async () => {
    let quotaGone = true;
    const v1 = fakeV1((id, call) =>
      quotaGone && call === 6 ? new QuotaExhaustedError("429") : roster(id, ago(T0, 0)),
    );
    const { deps, repo } = makeDeps(v1);

    const first = await runSnapshot(EVENT_ID, "before", deps);
    const kept = rowsOf(repo, first.snapshotId).map((r) => r.unionId);
    expect(first.status).toBe("partial");
    expect(kept.length).toBeGreaterThan(0);

    quotaGone = false;
    v1.calls.length = 0;
    const second = await runSnapshot(EVENT_ID, "before", deps);

    expect([...v1.calls].sort()).toEqual(IDS.filter((id) => !kept.includes(id)).sort());
    expect(rowsOf(repo, second.snapshotId)).toHaveLength(IDS.length);
    expect(second.status).toBe("complete");
  });
});
