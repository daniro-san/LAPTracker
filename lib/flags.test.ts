import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flagsOf } from "./flags";

// Next's data cache needs a Next request; here the read runs every time.
vi.mock("next/cache", () => ({ unstable_cache: <T>(read: T) => read }));

const KEY = { POSTHOG_KEY: "phc_test" };
const answer = (flags: Record<string, { enabled: boolean }>) =>
  new Response(JSON.stringify({ flags, errorsWhileComputingFlags: false }), { status: 200 });

// A failed read is remembered for 30 s on the module: each test starts an hour after the last one, past it.
let hour = Date.UTC(2026, 10, 17);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  hour += 3_600_000;
  vi.setSystemTime(hour);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("feature flags (D91)", () => {
  it("turns a flag on only when PostHog says enabled: true, asking for the fixed server id only", async () => {
    const posthog = vi.fn(async (_url: string, _init?: RequestInit) =>
      answer({ "merge-simulator": { enabled: true }, "chart-details": { enabled: false } }),
    );
    vi.stubGlobal("fetch", posthog);
    expect([...(await flagsOf(KEY))]).toEqual(["merge-simulator"]);
    const [url, init] = posthog.mock.calls[0] ?? [];
    expect(url).toBe("https://us.i.posthog.com/flags?v=2");
    expect(JSON.parse(String(init?.body))).toEqual({
      api_key: "phc_test",
      distinct_id: "laptracker-server",
    });
  });

  it("is off for every flag on an error status, a failed request or a body that is not JSON", async () => {
    for (const reply of [
      async () => new Response("{}", { status: 500 }),
      async () => Promise.reject(new TypeError("fetch failed")),
      async () => new Response("<html>", { status: 200 }),
    ]) {
      vi.setSystemTime(Date.now() + 31_000);
      const posthog = vi.fn(reply);
      vi.stubGlobal("fetch", posthog);
      expect((await flagsOf(KEY)).size).toBe(0);
      expect(posthog).toHaveBeenCalledTimes(1);
    }
  });

  it("shares one request between concurrent reads, and asks again only 30 s after a failure", async () => {
    const posthog = vi.fn(async () => answer({ "war-turnout": { enabled: true } }));
    vi.stubGlobal("fetch", posthog);
    const [one, two] = await Promise.all([flagsOf(KEY), flagsOf(KEY)]);
    expect([one.has("war-turnout"), two.has("war-turnout")]).toEqual([true, true]);
    expect(posthog).toHaveBeenCalledTimes(1);

    const down = vi.fn(async () => new Response("{}", { status: 503 }));
    vi.stubGlobal("fetch", down);
    expect((await flagsOf(KEY)).size).toBe(0);
    vi.stubGlobal("fetch", posthog);
    expect((await flagsOf(KEY)).size).toBe(0);
    expect(posthog).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 31_000);
    expect((await flagsOf(KEY)).has("war-turnout")).toBe(true);
  });

  it("reads LOCAL_FLAGS only without a PostHog key", async () => {
    const posthog = vi.fn(async () => answer({}));
    vi.stubGlobal("fetch", posthog);
    const local = { LOCAL_FLAGS: "war-turnout, kill-vs-might,unknown" };
    expect([...(await flagsOf(local))].sort()).toEqual(["kill-vs-might", "war-turnout"]);
    expect(posthog).not.toHaveBeenCalled();
    expect((await flagsOf({ ...local, ...KEY })).size).toBe(0);
  });
});
