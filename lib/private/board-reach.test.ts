import { describe, expect, it, vi } from "vitest";

import type { WorkspaceAccess } from "./access";
import { boardReach } from "./board-reach";

vi.mock("next/cache", () => ({ unstable_cache: <T>(read: T) => read }));

const ENV = { POSTHOG_QUERY_API_KEY: "phx_test", POSTHOG_API_BASE_URL: "https://posthog.test" };
const access = { ok: true, slug: "amber", workspaceId: 1 } as unknown as WorkspaceAccess;
const answer = (visitors: number) => async () =>
  new Response(JSON.stringify({ columns: ["board_visitors"], results: [[visitors]] }));

describe("the board's reach on Home (D145)", () => {
  it("gives the visitors from 5, rounded down to a multiple of 5, and nothing under 5", async () => {
    expect(await boardReach(ENV, answer(62), access)).toBe(60);
    expect(await boardReach(ENV, answer(5), access)).toBe(5);
    expect(await boardReach(ENV, answer(4), access)).toBeNull();
  });
});
