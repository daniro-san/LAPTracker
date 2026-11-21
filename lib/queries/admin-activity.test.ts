import { describe, expect, it, vi } from "vitest";

import { allianceActivity } from "./admin-activity";

vi.mock("next/cache", () => ({ unstable_cache: <T>(read: T) => read }));

const ENV = { POSTHOG_QUERY_API_KEY: "phx_test", POSTHOG_API_BASE_URL: "https://posthog.test" };
const COLUMNS = [
  "officers_active",
  "board_visitors",
  "notices_written",
  "roll_call_marks",
  "thanks_shared",
  "screenshots_read",
  "created",
  "key_saved",
  "webhook",
  "first_roll_call",
  "first_notice",
];

describe("/admin's Activity (D145)", () => {
  it("one call per workspace: totals rounded down to a multiple of 5 and under 5 as null, steps never reached as null, a workspace PostHog failed for left out", async () => {
    const posthog = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const { workspace } = JSON.parse(String(init?.body)).variables as { workspace: string };
      if (workspace === "cedar") return new Response("{}", { status: 503 });
      return new Response(
        JSON.stringify({
          columns: COLUMNS,
          results: [
            [
              3,
              41,
              6,
              120,
              1,
              9,
              "2026-11-10T09:00:00Z",
              "2026-11-10T09:30:00Z",
              "2026-11-11T08:00:00Z",
              "2026-11-12T18:00:00Z",
              "1970-01-01T00:00:00Z",
            ],
          ],
        }),
      );
    });
    const rows = await allianceActivity(ENV, posthog, ["amber", "cedar"]);
    expect(posthog).toHaveBeenCalledTimes(2);
    expect(rows).toEqual([
      {
        slug: "amber",
        totals: {
          officers_active: null,
          board_visitors: 40,
          notices_written: 5,
          roll_call_marks: 120,
          thanks_shared: null,
          screenshots_read: 5,
        },
        steps: {
          created: new Date("2026-11-10T09:00:00Z"),
          key_saved: new Date("2026-11-10T09:30:00Z"),
          webhook: new Date("2026-11-11T08:00:00Z"),
          first_roll_call: new Date("2026-11-12T18:00:00Z"),
          first_notice: null,
        },
      },
    ]);
  });
});
