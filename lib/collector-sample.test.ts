import { afterEach, describe, expect, it, vi } from "vitest";

import { RUN_DEADLINE_MS, runSample, runSnapshot } from "./collector";
import { SAMPLE_CALL_TIMEOUT_MS, SAMPLE_DEADLINE_MS } from "./collector-sample";
import {
  ago,
  EVENT_ID,
  fakeV1,
  IDS,
  makeDeps,
  minutes,
  roster,
  T0,
} from "./collector.test-helpers";
import { type CallOptions, UpstreamError } from "./sources/types";

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

  it("closes a sample partial at 25 s when every read hangs, and gives each call the 12 s timeout", async () => {
    vi.useFakeTimers({ now: T0 });
    const { v1, options } = recordingV1(() => new Promise(() => {}));
    const { deps } = makeDeps(v1);
    deps.now = () => new Date();

    const run = runSample(EVENT_ID, T0, deps);
    await vi.advanceTimersByTimeAsync(SAMPLE_DEADLINE_MS + 1_000);
    const summary = await run;

    expect(SAMPLE_DEADLINE_MS).toBeLessThan(RUN_DEADLINE_MS);
    expect(summary).toMatchObject({ phase: "sample", status: "partial", error: "deadline" });
    expect(summary.durationMs).toBeGreaterThanOrEqual(SAMPLE_DEADLINE_MS);
    expect(summary.durationMs).toBeLessThanOrEqual(SAMPLE_DEADLINE_MS + 1_000);
    expect(summary.failed.map((f) => f.error)).toEqual(IDS.map(() => "not fetched: deadline"));
    expect(options.quota).toEqual([{ timeoutMs: SAMPLE_CALL_TIMEOUT_MS, maxRetries: undefined }]);
    expect([...options.alliance.values()]).toEqual(
      [...options.alliance.keys()].map(() => ({
        timeoutMs: SAMPLE_CALL_TIMEOUT_MS,
        maxRetries: undefined,
      })),
    );
  });

  it("reads an alliance that failed in an earlier sample of the event once, with no retries", async () => {
    const failing = recordingV1(async (id) => {
      if (id === FIRST) throw new UpstreamError(502);
      return fresh(id);
    });
    const { deps } = makeDeps(failing.v1);
    expect(await runSample(EVENT_ID, T0, deps)).toMatchObject({ status: "partial" });
    expect(failing.options.alliance.get(FIRST)).toEqual({
      timeoutMs: SAMPLE_CALL_TIMEOUT_MS,
      maxRetries: undefined,
    });

    deps.now = () => new Date(T0.getTime() + minutes(15));
    await runSample(EVENT_ID, new Date(T0.getTime() + minutes(15)), deps);

    expect(failing.options.alliance.get(FIRST)).toEqual({
      timeoutMs: SAMPLE_CALL_TIMEOUT_MS,
      maxRetries: 0,
    });
    expect(failing.options.alliance.get(SECOND)).toEqual({
      timeoutMs: SAMPLE_CALL_TIMEOUT_MS,
      maxRetries: undefined,
    });
  });

  it("gives a Before and After the adapter's defaults: no per-call options", async () => {
    const { v1, options } = recordingV1(async (id) => fresh(id));
    const { deps } = makeDeps(v1);

    await runSnapshot(EVENT_ID, "before", deps);

    expect(options.quota).toEqual([{}]);
    expect([...options.alliance.values()]).toEqual(IDS.map(() => ({})));
  });
});
