import { describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV } from "@/lib/app-context.test-helpers";
import { FRAME_CACHE } from "@/lib/images";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { GET } = await import("./route");

const get = (id: string) =>
  GET(new Request(`https://app.test/img/frame/${id}`), { params: Promise.resolve({ id }) });

describe("GET /img/frame/[id]", () => {
  it("fetches a numeric frame id from the site, serves it as fetched, and refuses anything else", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(new Uint8Array([1, 2]), { headers: { "content-type": "image/png" } }),
    );
    holder.ctx = { env: TEST_ENV, fetch } as unknown as AppContext;

    const res = await get("5010");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(FRAME_CACHE);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      "https://site.test/static/frames/frame_5010.png",
    ]);

    for (const id of ["0", "abc", "50a", "-5001", "5001.png", "1234567890", "..%2Fx"]) {
      const res = await get(id);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("");
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
