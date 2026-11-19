import { beforeAll, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { HERO_CACHE } from "@/lib/heroes";
import { saveHeroCatalog } from "@/lib/repo/hero-catalog";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { GET } = await import("./route");

const get = (id: string) =>
  GET(new Request(`https://app.test/img/hero/${id}`), { params: Promise.resolve({ id }) });

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  await saveHeroCatalog(db, [{ id: 10005, name: "Kesso" }], new Date("2026-11-17T00:00:00Z"));
});

describe("GET /img/hero/[id] (D117)", () => {
  it("fetches a catalog hero from the site's static files, and refuses any other id", async () => {
    // A WebP is served as fetched (only PNG and JPEG are redrawn smaller).
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(new Uint8Array([1, 2]), { headers: { "content-type": "image/webp" } }),
    );
    holder.ctx = {
      env: TEST_ENV,
      fetch,
      openDb: () => ({ db, close: async () => undefined }),
    } as unknown as AppContext;

    const res = await get("10005");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(HERO_CACHE);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      "https://site.test/static/heroes/10005.png",
    ]);

    // 10006 is a well-formed id the catalog does not list: never fetched.
    for (const id of ["10006", "0", "abc", "-10005", "10005.png", "1234567890", "..%2Fx"]) {
      const res = await get(id);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("");
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
