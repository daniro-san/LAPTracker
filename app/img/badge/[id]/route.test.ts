import { ImageResponse } from "next/og";
import { createElement } from "react";
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

  it("serves a 300 × 300 badge redrawn as an 80 × 80 PNG (07c S11)", async () => {
    const square = (px: number) =>
      new ImageResponse(
        createElement("div", {
          style: { display: "flex", width: px, height: px, background: "black" },
        }),
        {
          width: px,
          height: px,
        },
      ).arrayBuffer();
    const upstream = await square(300);
    holder.ctx = {
      env: TEST_ENV,
      fetch: async () => new Response(upstream, { headers: { "content-type": "image/png" } }),
    } as unknown as AppContext;

    const res = await get("105");
    const png = new DataView(await res.arrayBuffer());
    // IHDR: width and height are the big-endian words at bytes 16 and 20.
    expect([png.getUint32(16), png.getUint32(20)]).toEqual([80, 80]);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(png.byteLength).toBeLessThan(upstream.byteLength);
  });

  it("serves the badge as fetched when redrawing it would make a larger file", async () => {
    const tiny = await new ImageResponse(
      createElement("div", {
        style: { display: "flex", width: 8, height: 8, background: "black" },
      }),
      { width: 8, height: 8 },
    ).arrayBuffer();
    holder.ctx = {
      env: TEST_ENV,
      fetch: async () => new Response(tiny, { headers: { "content-type": "image/png" } }),
    } as unknown as AppContext;

    const png = new DataView(await (await get("101")).arrayBuffer());
    expect([png.getUint32(16), png.byteLength]).toEqual([8, tiny.byteLength]);
  });
});
