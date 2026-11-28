import { afterEach, describe, expect, it, vi } from "vitest";

import { runSample, runSnapshot } from "./collector";
import { SAMPLE_CALL_TIMEOUT_MS, SAMPLE_DEADLINE_MS } from "./collector-sample";
import {
  ago,
  EVENT_ID,
  fakeV1,
  IDS,
  LABELS,
  makeDeps,
  minutes,
  roster,
  rowsOf,
  T0,
} from "./collector.test-helpers";
import { createMemoryRepo } from "./repo/memory";
import { v1 as realV1 } from "./sources";
import { TIMEOUT_MS } from "./sources/shared";
import { readFixture, respond, stubSourceEnv } from "./sources/test-helpers";
import type { CallOptions } from "./sources/types";

const fresh = (id: number) => roster(id, ago(T0, minutes(2)));
const [FIRST, SECOND] = IDS as [number, number];

describe("runSample hardening (D69)", () => {
  afterEach(() => vi.useRealTimers());

  /** A /v1 fake that records the options each call got; `answer` decides what a read does. */
  const recordingV1 = (answer: (id: number) => Promise<ReturnType<typeof fresh>>) => {
    const options: { quota: CallOptions[]; alliance: Map<number, CallOptions | undefined> } = {
      quota: [],
      alliance: new Map(),
    };
    const v1 = fakeV1(fresh);
    v1.fetchQuota = async (onAttempt, _signal, o) => {
      onAttempt?.(0);
      options.quota.push(o ?? {});
      return { limit: 1000, used: 0, remaining: 1000 };
    };
    v1.fetchAlliance = async (id, onAttempt, _signal, o) => {
      onAttempt?.(0);
      options.alliance.set(id, o);
      return answer(id);
    };
    return { v1, options };
  };

  it("closes a sample partial at 25 s when every read hangs, and gives each call the sample's timeout and one attempt", async () => {
    vi.useFakeTimers({ now: T0 });
    const { v1, options } = recordingV1(() => new Promise(() => {}));
    const { deps } = makeDeps(v1);
    // The fake timers' clock, started at T0: it moves as the test advances the timers.
    deps.now = () => vi.getMockedSystemTime() ?? T0;

    const run = runSample(EVENT_ID, T0, deps);
    await vi.advanceTimersByTimeAsync(SAMPLE_DEADLINE_MS + 1_000);
    const summary = await run;

    expect(summary).toMatchObject({ phase: "sample", status: "partial", error: "deadline" });
    expect(summary.durationMs).toBeGreaterThanOrEqual(SAMPLE_DEADLINE_MS);
    expect(summary.durationMs).toBeLessThanOrEqual(SAMPLE_DEADLINE_MS + 1_000);
    expect(summary.failed.map((f) => f.error)).toEqual(IDS.map(() => "not fetched: deadline"));
    expect(options.quota).toEqual([{ timeoutMs: SAMPLE_CALL_TIMEOUT_MS, maxRetries: 0 }]);
    expect([...options.alliance.values()]).toEqual(
      [...options.alliance.keys()].map(() => ({
        timeoutMs: SAMPLE_CALL_TIMEOUT_MS,
        maxRetries: 0,
      })),
    );
  });

  it("gives a Before and After the adapter's defaults: no per-call options", async () => {
    const { v1, options } = recordingV1(async (id) => fresh(id));
    const { deps } = makeDeps(v1);

    await runSnapshot(EVENT_ID, "before", deps);

    expect(options.quota).toEqual([{}]);
    expect([...options.alliance.values()]).toEqual(IDS.map(() => ({})));
  });
});

describe("a hung call in a sample (issue 866)", () => {
  const OGS = JSON.parse(readFixture("v1-20261104T155902Z/alliance-67111155.json")) as object;
  const HUNG = IDS.slice(0, 4);

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** The real /v1 adapter over a mocked fetch: `answer` says what each alliance's attempt gets. A hung call
   * waits on its signal, as fetch does; AbortSignal.timeout runs on the fake timers. */
  function upstream(answer: (id: number, attempt: number) => "hang" | 503 | 200) {
    stubSourceEnv();
    vi.useFakeTimers({ now: T0 });
    const timeouts = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const c = new AbortController();
      setTimeout(() => c.abort(new DOMException("timed out", "TimeoutError")), ms);
      return c.signal;
    });
    const attempts = new Map<number, number>();
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/quota"))
        return Promise.resolve(respond('{"quota":{"limit":1000,"used":0,"remaining":1000}}'));
      const id = Number(/alliances\/(\d+)/.exec(url)?.[1]);
      const n = attempts.get(id) ?? 0;
      attempts.set(id, n + 1);
      const outcome = answer(id, n);
      return new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        if (outcome === "hang") return;
        const body = outcome === 503 ? "error code: 503" : JSON.stringify({ ...OGS, union_id: id });
        // A normal read answers in about 1 s.
        setTimeout(() => resolve(respond(body, outcome)), 1_000);
      });
    });
    vi.stubGlobal("fetch", fetch);
    // No daily rosters: the fixture's members are not the invented alliances' own.
    const repo = createMemoryRepo([{ id: EVENT_ID, allianceIds: IDS }], IDS, LABELS);
    const deps = { ...makeDeps(realV1).deps, repo, now: () => vi.getMockedSystemTime() ?? T0 };
    return { deps, repo, attempts, timeouts };
  }

  it("reads the other 16 alliances before the deadline while 4 calls hang until their timeout", async () => {
    const { deps, repo, timeouts } = upstream((id) => (HUNG.includes(id) ? "hang" : 200));

    const run = runSample(EVENT_ID, T0, deps);
    await vi.advanceTimersByTimeAsync(SAMPLE_DEADLINE_MS);
    const summary = await run;

    expect(summary).toMatchObject({ status: "partial", error: null });
    expect(summary.durationMs).toBeLessThan(SAMPLE_DEADLINE_MS);
    const rows = rowsOf(repo, summary.snapshotId);
    expect(rows.filter((r) => r.error === null)).toHaveLength(IDS.length - HUNG.length);
    expect(summary.failed).toEqual(
      HUNG.map((unionId) => ({ unionId, tag: LABELS.get(unionId)?.tag, error: "v1 TimeoutError" })),
    );
    expect(new Set(timeouts.mock.calls.map(([ms]) => ms))).toEqual(
      new Set([SAMPLE_CALL_TIMEOUT_MS]),
    );
  });

  it("never retries a sample's call: a 503 is the alliance's error row", async () => {
    const { deps, repo, attempts } = upstream((id, n) => (id === FIRST && n === 0 ? 503 : 200));

    const run = runSample(EVENT_ID, T0, deps);
    await vi.advanceTimersByTimeAsync(SAMPLE_DEADLINE_MS);
    const summary = await run;

    expect(attempts.get(FIRST)).toBe(1);
    expect(rowsOf(repo, summary.snapshotId).find((r) => r.unionId === FIRST)?.error).toBe(
      "v1 http 503",
    );
  });

  it("still retries a Before's call, with the adapter's 30 s timeout", async () => {
    const { deps, repo, attempts, timeouts } = upstream((id, n) =>
      id === FIRST && n === 0 ? 503 : 200,
    );

    const run = runSnapshot(EVENT_ID, "before", deps);
    await vi.advanceTimersByTimeAsync(60_000);
    const summary = await run;

    expect(attempts.get(FIRST)).toBe(2);
    expect(rowsOf(repo, summary.snapshotId).find((r) => r.unionId === FIRST)?.error).toBeNull();
    expect(new Set(timeouts.mock.calls.map(([ms]) => ms))).toEqual(new Set([TIMEOUT_MS]));
  });
});

describe("a sample's identity check (D69 amendment, 2026-11-21)", () => {
  const [, , THIRD] = IDS as [number, number, number];

  it("stores no row for a read that holds another alliance, counts it failed, and spends no extra call", async () => {
    // FIRST's answer carries SECOND's id; THIRD's carries its own id with FIRST's tag and members.
    const v1 = fakeV1((id) =>
      id === FIRST ? fresh(SECOND) : id === THIRD ? { ...fresh(FIRST), unionId: THIRD } : fresh(id),
    );
    const { deps, repo } = makeDeps(v1);

    const summary = await runSample(EVENT_ID, T0, deps);

    const rows = rowsOf(repo, summary.snapshotId);
    expect(rows.filter((r) => r.unionId === SECOND)).toHaveLength(1);
    expect(rows.find((r) => r.unionId === FIRST)).toMatchObject({
      error: "v1 wrong alliance (id)",
      tag: `T${FIRST % 1000}`,
      totalKills: null,
    });
    expect(rows.find((r) => r.unionId === THIRD)?.error).toBe("v1 wrong alliance (tag)");
    expect(summary.status).toBe("partial");
    expect(summary.callsUsed).toBe(IDS.length + 1);
    expect(await repo.failedSampleUnionIds(EVENT_ID)).toEqual([FIRST, THIRD]);
  });

  it("stores a read under a new tag and name when its members are the alliance's own: a rename", async () => {
    const v1 = fakeV1((id) =>
      id === FIRST ? { ...fresh(id), tag: "NEW", name: "New name" } : fresh(id),
    );
    const { deps, repo } = makeDeps(v1);

    const summary = await runSample(EVENT_ID, T0, deps);

    expect(summary.status).toBe("complete");
    const row = rowsOf(repo, summary.snapshotId).find((r) => r.unionId === FIRST);
    expect(row).toMatchObject({ tag: "NEW", error: null, totalKills: 300 });
  });

  it("stores a read it cannot compare: the alliance has no daily roster yet", async () => {
    const v1 = fakeV1((id) => (id === FIRST ? { ...fresh(SECOND), unionId: FIRST } : fresh(id)));
    const repo = createMemoryRepo([{ id: EVENT_ID, allianceIds: IDS }], IDS, LABELS);
    const deps = { ...makeDeps(v1).deps, repo };

    const summary = await runSample(EVENT_ID, T0, deps);

    const row = rowsOf(repo, summary.snapshotId).find((r) => r.unionId === FIRST);
    expect(row).toMatchObject({ tag: `T${SECOND % 1000}`, error: null });
  });
});
