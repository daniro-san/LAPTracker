import { describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV } from "@/lib/app-context.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { GET } = await import("./route");

const get = (id: string) =>
  GET(new Request(`https://app.test/img/badge/${id}`), { params: Promise.resolve({ id }) });

describe("GET /img/badge/[id]", () => {
  it("fetches only the preset badges 101–110 and refuses every other id", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } }),
    );
    holder.ctx = { env: TEST_ENV, fetch } as unknown as AppContext;

    for (const id of ["101", "110"]) expect((await get(id)).status).toBe(200);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      "https://site.test/static/alliance/badge_101.png",
      "https://site.test/static/alliance/badge_110.png",
    ]);

    for (const id of ["100", "111", "0", "1101", "abc", "10a", "-101"]) {
      const res = await get(id);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("");
    }
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
