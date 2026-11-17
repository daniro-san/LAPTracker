import { afterEach, describe, expect, it, vi } from "vitest";

import { flagsOf } from "./flags";

// Next's data cache needs a Next request; here the read runs every time.
vi.mock("next/cache", () => ({ unstable_cache: <T>(read: T) => read }));

const KEY = { POSTHOG_KEY: "phc_test" };
const answer = (flags: Record<string, { enabled: boolean }>) =>
  new Response(JSON.stringify({ flags, errorsWhileComputingFlags: false }), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
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
      vi.stubGlobal("fetch", reply);
      expect((await flagsOf(KEY)).size).toBe(0);
    }
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
