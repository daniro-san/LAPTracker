import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardToPostHog, MAX_BODY_BYTES } from "./ingest";

const SITE = "https://laptracker.test";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/ingest proxy (D77)", () => {
  it("forwards only the SDK's paths, without the visitor's headers, and refuses a body over the cap", async () => {
    const upstream = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response('{"status":1}', { status: 200 }),
    );
    vi.stubGlobal("fetch", upstream);
    const post = (path: string, headers: Record<string, string> = {}) =>
      forwardToPostHog(
        new Request(`${SITE}/ingest${path}`, {
          method: "POST",
          body: "x",
          headers: { "content-type": "text/plain", cookie: "__Host-lap_ws=token", ...headers },
        }),
      );

    const visitor = { "x-real-ip": "203.0.113.7", "user-agent": "Mozilla/5.0", referer: SITE };
    expect((await post("/e/?ver=1.444.4", visitor)).status).toBe(200);
    expect((await post("/s/", visitor)).status).toBe(200);
    expect((await post("/c/e/?ver=1.444.4", visitor)).status).toBe(200);
    expect(upstream.mock.calls.map(([url]) => url)).toEqual([
      "https://us.i.posthog.com/e/?ver=1.444.4",
      "https://us.i.posthog.com/s/",
      "https://us.i.posthog.com/e/?ver=1.444.4",
    ]);
    const headersOf = (i: number) =>
      Object.fromEntries(new Headers(upstream.mock.calls[i]?.[1]?.headers).entries());
    // D115: only a cookieless page load's events (/ingest/c/…) carry the visitor's IP, for the daily hash.
    expect(headersOf(0)).toEqual({ "content-type": "text/plain", origin: SITE });
    expect(headersOf(1)).toEqual({ "content-type": "text/plain", origin: SITE });
    expect(headersOf(2)).toEqual({
      "content-type": "text/plain",
      origin: SITE,
      "x-forwarded-for": "203.0.113.7",
    });

    upstream.mockClear();
    expect((await post("/api/projects/")).status).toBe(404);
    expect((await post("/static/recorder.js")).status).toBe(404);
    expect((await forwardToPostHog(new Request(`${SITE}/ingest/e/`))).status).toBe(404);
    expect((await post("/e/", { "content-length": String(MAX_BODY_BYTES + 1) })).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("takes the visitor's IP from x-forwarded-for's first address when x-real-ip is absent", async () => {
    const upstream = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}"));
    vi.stubGlobal("fetch", upstream);
    await forwardToPostHog(
      new Request(`${SITE}/ingest/c/i/v0/e/`, {
        method: "POST",
        body: "x",
        headers: { "x-forwarded-for": "198.51.100.4, 10.0.0.1" },
      }),
    );
    expect(new Headers(upstream.mock.calls[0]?.[1]?.headers).get("x-forwarded-for")).toBe(
      "198.51.100.4",
    );
  });
});
