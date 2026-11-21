import { describe, expect, it, vi } from "vitest";

import { endpointRow, ENDPOINTS, firstTime, shownTotal } from "./endpoints";

// Next's data cache needs a Next request; here the read runs every time.
vi.mock("next/cache", () => ({ unstable_cache: <T>(read: T) => read }));

const ENV = {
  POSTHOG_QUERY_API_KEY: "phx_test",
  POSTHOG_API_BASE_URL: "https://posthog.test",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("PostHog Endpoints (D145)", () => {
  it("runs the pinned Endpoint by name with the workspace as its one variable, and keys the row by column", async () => {
    const posthog = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      reply({ columns: ["board_visitors", "notices_seen"], results: [[62, 48]] }),
    );
    const row = await endpointRow(ENV, posthog, ENDPOINTS.boardReach, "amber", 3600);
    expect(row).toEqual({ board_visitors: 62, notices_seen: 48 });
    const [url, init] = posthog.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://posthog.test/api/projects/741657/endpoints/lap_board_reach/run?version=1",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer phx_test");
    expect(JSON.parse(String(init?.body))).toEqual({ variables: { workspace: "amber" } });
  });

  it("is null with no key (no request), on an error status, a failed request or an answer of another shape", async () => {
    const none = vi.fn(async () => reply({}));
    expect(
      await endpointRow(
        { POSTHOG_API_BASE_URL: ENV.POSTHOG_API_BASE_URL },
        none,
        ENDPOINTS.boardReach,
        "amber",
        3600,
      ),
    ).toBeNull();
    expect(none).not.toHaveBeenCalled();
    for (const answer of [
      async () => reply({ detail: "nope" }, 500),
      async () => Promise.reject(new DOMException("timed out", "TimeoutError")),
      async () => reply({ rows: [] }),
    ]) {
      expect(await endpointRow(ENV, answer, ENDPOINTS.boardReach, "amber", 3600)).toBeNull();
    }
  });

  it("shows a total only from 5, rounded down to a multiple of 5, and reads minIf's 1970 as never", () => {
    expect([4, 5, "7", 62, 2.5, null].map(shownTotal)).toEqual([null, 5, 5, 60, null, null]);
    expect(firstTime("1970-01-01T00:00:00Z")).toBeNull();
    expect(firstTime("2026-11-20T10:00:00Z")?.toISOString()).toBe("2026-11-20T10:00:00.000Z");
  });
});
