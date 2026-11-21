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
  // A column the app does not read, as version 1's setup columns: ignored.
  "created",
];

describe("/admin's Activity (D145, amended 2026-11-21)", () => {
  it("one call per workspace: people under 5 as null and the rest rounded down, action counts exact from 0, a workspace PostHog failed for left out", async () => {
    const posthog = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const { workspace } = JSON.parse(String(init?.body)).variables as { workspace: string };
      if (workspace === "cedar") return new Response("{}", { status: 503 });
      return new Response(
        JSON.stringify({
          columns: COLUMNS,
          results: [[3, 41, 6, "122", 0, 4, "2026-11-10T09:00:00Z"]],
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
          notices_written: 6,
          roll_call_marks: 122,
          thanks_shared: 0,
          screenshots_read: 4,
        },
      },
    ]);
  });
});
