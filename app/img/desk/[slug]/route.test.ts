// GET /img/desk/[slug] (issue 462, D167, D22): a workspace's chosen icon from our own origin. The server's icon is
// fetched here from Discord's CDN and served as the response body: never a redirect to Discord, so viewers
// and Discord's avatar fetch only reach our origin. The desk mark and bad input are a plain 404.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { workspaces } from "@/lib/schema";
import { alliances } from "@/lib/schema-alliances";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { GET } = await import("./route");

const HASH = "c".repeat(32);
let db: Db;
let fetched: { url: string; redirect?: RequestRedirect | undefined }[] = [];

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  fetched = [];
  const ctx = testContext(db, TEST_ENV).ctx;
  ctx.fetch = async (input, init) => {
    fetched.push({ url: String(input), redirect: init?.redirect });
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
  };
  holder.ctx = ctx;
  await db.delete(alliances);
  await db.insert(alliances).values({
    unionId: 67109944,
    tag: "NSE",
    name: "Natural Selection",
    badgeId: 104,
    firstSeenDay: "2026-11-01",
    lastSeenDay: "2026-11-27",
  });
  await db.insert(workspaces).values({
    unionId: 67109944,
    slug: "nse",
    discordGuildId: "424242",
    leaderRoleIds: ["2"],
    discordIconHash: HASH,
  });
});

const get = (slug = "nse", query = "?size=512") =>
  GET(new Request(`https://laptracker.test/img/desk/${slug}${query}`), {
    params: Promise.resolve({ slug }),
  });

describe("GET /img/desk/[slug]", () => {
  it("serves the badge by default, fetched from the tracker site", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(fetched.map((f) => f.url)).toEqual(["https://site.test/static/alliance/badge_104.png"]);
  });

  it("serves the server's icon itself, never a redirect to Discord's CDN", async () => {
    await db.update(workspaces).set({ brandIcon: "discord" });
    const res = await get("nse", "?size=192");
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3]);
    // Fetched by the server, with redirects refused; only the one icon of the workspace's own server.
    expect(fetched).toEqual([
      {
        url: `https://cdn.discordapp.com/icons/424242/${HASH}.png?size=192`,
        redirect: "error",
      },
    ]);
  });

  it("is a 404 for the desk mark, a server with no icon, an unknown slug or a size not offered", async () => {
    await db.update(workspaces).set({ brandIcon: "mark" });
    expect((await get()).status).toBe(404);
    await db.update(workspaces).set({ brandIcon: "discord", discordIconHash: null });
    expect((await get()).status).toBe(404);
    expect((await get("nowhere")).status).toBe(404);
    expect((await get("nse", "?size=64")).status).toBe(404);
    expect(fetched).toEqual([]);
  });
});
