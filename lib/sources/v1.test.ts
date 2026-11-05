import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  headersOf,
  mockFetch,
  readFixture,
  respond,
  stubSourceEnv,
  v1AllianceFixtures,
} from "./test-helpers";
import { NotFoundError, QuotaExhaustedError, SchemaError, UpstreamError } from "./types";
import { fetchAlliance, fetchQuota } from "./v1";

const OGS = "v1-20261104T155902Z/alliance-67111155.json";
const AFR = "v1-ids/67111040.json";
const gateway = (status: number, headers: Record<string, string> = {}) =>
  respond(`error code: ${status}`, status, headers);

type RawMember = { kills: number | null };

beforeEach(() => {
  stubSourceEnv();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("v1.fetchAlliance parsing", () => {
  it("parses every recorded /v1 body with totalKills equal to the member sum, nulls as 0", async () => {
    const files = v1AllianceFixtures();
    expect(files.length).toBe(24);
    for (const file of files) {
      const body = readFixture(file);
      const raw = JSON.parse(body) as { members: RawMember[]; power: number; union_id: number };
      mockFetch(respond(body));
      const a = await fetchAlliance(raw.union_id);
      expect(a.unionId).toBe(raw.union_id);
      expect(a.totalKills).toBe(raw.members.reduce((t, m) => t + (m.kills ?? 0), 0));
      expect(a.totalPower).toBe(raw.power);
      expect(a.members).toHaveLength(raw.members.length);
      expect(a.raw).toEqual(raw);
    }
  });

  it("keeps a null kills value on the member row (AFR)", async () => {
    mockFetch(respond(readFixture(AFR)));
    const a = await fetchAlliance(67111040);
    expect(a.members.find((m) => m.uid === 465317781829)?.kills).toBeNull();
    expect(a.totalKills).toBeGreaterThan(0);
  });

  it("keeps each member's rank_code and rank_label, and null when the body sends none", async () => {
    const body = JSON.parse(readFixture(OGS)) as { members: Record<string, unknown>[] };
    const [first, second] = body.members as [Record<string, unknown>, Record<string, unknown>];
    delete second.rank_code;
    delete second.rank_label;
    mockFetch(respond(JSON.stringify(body)));
    const a = await fetchAlliance(67111155);
    expect(a.members[0]).toMatchObject({ rankCode: first.rank_code, rankLabel: first.rank_label });
    expect(a.members[1]).toMatchObject({ rankCode: null, rankLabel: null });
    expect(a.members.some((m) => m.rankCode === 105 && m.rankLabel === "R5")).toBe(true);
  });

  it("parses cached, sourceUpdatedAt, rank, level and quota from the alliance body", async () => {
    mockFetch(respond(readFixture(OGS)));
    const a = await fetchAlliance(67111155);
    expect(a).toMatchObject({ tag: "OGs", name: "OldGrandmas", cached: false, serverRank: 2 });
    expect(a.sourceUpdatedAt?.toISOString()).toMatch(/^2026-11-04T15:59:0/);
    expect(a.quota).toEqual({ limit: 1000, used: 6, remaining: 994 });

    const cachedBody = readFixture(OGS).replace('"cached":false', '"cached":true');
    mockFetch(respond(cachedBody));
    expect((await fetchAlliance(67111155)).cached).toBe(true);
  });

  it("reads the alliance capacity, and keeps null when the body has none", async () => {
    mockFetch(respond(readFixture(OGS)));
    expect((await fetchAlliance(67111155)).capacity).toBe(100);
    mockFetch(respond(readFixture(OGS).replace('"capacity":100,', "")));
    expect((await fetchAlliance(67111155)).capacity).toBeNull();
  });

  it("throws SchemaError v1.schema with the path when a read field is renamed", async () => {
    mockFetch(respond(readFixture(OGS).replaceAll('"nick_name"', '"nickname"')));
    const error = await fetchAlliance(67111155).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SchemaError);
    expect(error).toMatchObject({ code: "v1.schema" });
    expect((error as SchemaError).paths[0]).toBe("members.0.nick_name");
  });
});

describe("v1.fetchQuota", () => {
  it("parses the quota object of /v1/quota", async () => {
    const mock = mockFetch(respond(readFixture("v1-20261104T154755Z/quota-before.json")));
    expect(await fetchQuota()).toEqual({ limit: 1000, used: 1, remaining: 999 });
    expect(String(mock.mock.calls[0]?.[0])).toBe("https://v1.test/v1/quota");
  });
});

describe("v1 requests", () => {
  it("sends Authorization and User-Agent on every attempt, retries included", async () => {
    const mock = mockFetch(gateway(503), respond(readFixture(OGS)));
    const done = fetchAlliance(67111155);
    await vi.runAllTimersAsync();
    await done;
    expect(mock).toHaveBeenCalledTimes(2);
    for (const call of [0, 1]) {
      expect(headersOf(mock, call).get("authorization")).toBe("Bearer lap_test-placeholder");
      expect(headersOf(mock, call).get("user-agent")).toBe(
        "laptracker/1.0 (+https://github.com/daniro-san/LAPTracker)",
      );
    }
    expect(String(mock.mock.calls[0]?.[0])).toBe("https://v1.test/v1/alliances/67111155");
  });

  it("retries 503 and 502 with 1 s then 2 s backoff and then succeeds", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const mock = mockFetch(gateway(503), gateway(502), respond(readFixture(OGS)));
    const done = fetchAlliance(67111155);
    await vi.advanceTimersByTimeAsync(999);
    expect(mock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect((await done).unionId).toBe(67111155);
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it("waits the Retry-After seconds instead of the backoff", async () => {
    const mock = mockFetch(gateway(503, { "Retry-After": "7" }), respond(readFixture(OGS)));
    const done = fetchAlliance(67111155);
    await vi.advanceTimersByTimeAsync(6999);
    expect(mock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 retries (4 attempts) with UpstreamError carrying the status", async () => {
    const mock = mockFetch(gateway(504), gateway(504), gateway(504), gateway(504), gateway(504));
    const done = fetchAlliance(67111155).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const error = await done;
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ status: 504 });
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it("reports every attempt to onAttempt before sending it, and sends nothing when it throws", async () => {
    const mock = mockFetch(gateway(502), respond(readFixture(OGS)));
    const attempts: number[] = [];
    const done = fetchAlliance(67111155, (n) => attempts.push(n));
    await vi.runAllTimersAsync();
    await done;
    expect(attempts).toEqual([0, 1]);
    expect(mock).toHaveBeenCalledTimes(2);

    const refused = fetchQuota(() => {
      throw new Error("cap");
    });
    await expect(refused).rejects.toThrow("cap");
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("sends a signal that aborts with the caller's signal, on top of the per-call timeout", async () => {
    const mock = mockFetch(respond(readFixture(OGS)));
    const controller = new AbortController();
    await fetchAlliance(67111155, undefined, controller.signal);
    const sent = (mock.mock.calls[0]?.[1] as RequestInit).signal as AbortSignal;
    expect(sent.aborted).toBe(false);
    controller.abort();
    expect(sent.aborted).toBe(true);
  });

  it("aborts on 429 with QuotaExhaustedError and no retry", async () => {
    const mock = mockFetch(respond("{}", 429), respond(readFixture(OGS)));
    await expect(fetchAlliance(67111155)).rejects.toBeInstanceOf(QuotaExhaustedError);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("maps 404 to NotFoundError with no retry", async () => {
    const mock = mockFetch(respond('{"detail":"not found"}', 404));
    await expect(fetchAlliance(1)).rejects.toBeInstanceOf(NotFoundError);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("decides on the status code, not statusText", async () => {
    // Over HTTP/2 statusText is empty; a non-2xx with statusText "OK" must still fail.
    mockFetch(new Response("{}", { status: 500, statusText: "OK" }));
    await expect(fetchAlliance(1)).rejects.toMatchObject({ status: 500 });
  });

  it("never has more than 4 requests in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const release: (() => void)[] = [];
    const body = readFixture(OGS);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        return new Promise<Response>((resolve) =>
          release.push(() => {
            inFlight--;
            resolve(respond(body));
          }),
        );
      }),
    );
    const all = Promise.all(Array.from({ length: 10 }, () => fetchAlliance(67111155)));
    while (release.length > 0 || inFlight > 0) {
      await vi.advanceTimersByTimeAsync(0);
      release.shift()?.();
    }
    expect((await all).length).toBe(10);
    expect(peak).toBe(4);
  });
});
