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

    expect((await post("/e/?ver=1.444.4")).status).toBe(200);
    expect((await post("/s/")).status).toBe(200);
    expect(upstream.mock.calls.map(([url]) => url)).toEqual([
      "https://us.i.posthog.com/e/?ver=1.444.4",
      "https://us.i.posthog.com/s/",
    ]);
    const sent = upstream.mock.calls[0]?.[1];
    expect(Object.fromEntries(new Headers(sent?.headers).entries())).toEqual({
      "content-type": "text/plain",
      origin: SITE,
    });

    upstream.mockClear();
    expect((await post("/api/projects/")).status).toBe(404);
    expect((await post("/static/recorder.js")).status).toBe(404);
    expect((await forwardToPostHog(new Request(`${SITE}/ingest/e/`))).status).toBe(404);
    expect((await post("/e/", { "content-length": String(MAX_BODY_BYTES + 1) })).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
});
