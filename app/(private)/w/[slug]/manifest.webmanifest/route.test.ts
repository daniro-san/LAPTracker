// GET /w/[slug]/manifest.webmanifest (D110, issue 462, D167): the installed app's name, icon and theme colour
// follow the workspace's branding, and without a saved one it is "[TAG] Desk" with the alliance's badge.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { accentColor } from "@/lib/brand/palette";
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

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
  await db
    .insert(workspaces)
    .values({ unionId: 67109944, slug: "nse", discordGuildId: "11111", leaderRoleIds: ["2"] });
});

const manifest = async () => {
  const res = await GET(new Request("https://laptracker.test/w/nse/manifest.webmanifest"), {
    params: Promise.resolve({ slug: "nse" }),
  });
  return (await res.json()) as {
    name: string;
    short_name: string;
    theme_color: string;
    scope: string;
    icons: { src: string }[];
    share_target: { action: string };
  };
};

describe("the desk's manifest follows the branding", () => {
  it("is [TAG] Desk with the badge until an officer sets something", async () => {
    await db.delete(alliances);
    await db.insert(alliances).values({
      unionId: 67109944,
      tag: "NSE",
      name: "Natural Selection",
      badgeId: 103,
      firstSeenDay: "2026-11-01",
      lastSeenDay: "2026-11-27",
    });
    const m = await manifest();
    expect(m.name).toBe("[NSE] Desk");
    expect(m.icons.map((i) => i.src)).toEqual([
      "/img/desk/nse?size=192&v=badge-103",
      "/img/desk/nse?size=512&v=badge-103",
    ]);
    // The desk's scope and share target do not depend on it (D110).
    expect([m.scope, m.share_target.action]).toEqual(["/w/nse", "/w/nse/share"]);
  });

  it("takes the saved title, the mark and the accent colour", async () => {
    await db
      .update(workspaces)
      .set({ brandTitle: "Night Watch", brandIcon: "mark", brandAccent: "teal" });
    const m = await manifest();
    expect([m.name, m.short_name]).toEqual(["Night Watch", "Night Watch"]);
    expect(m.icons.map((i) => i.src)).toEqual(["/icon/192", "/icon/512"]);
    expect(m.theme_color).toBe(accentColor("teal"));
  });

  it("names the server's icon through our own route, never Discord's CDN", async () => {
    await db.update(workspaces).set({ brandIcon: "discord", discordIconHash: "b".repeat(32) });
    const m = await manifest();
    expect(m.icons.map((i) => i.src)).toEqual([
      `/img/desk/nse?size=192&v=discord-${"b".repeat(32)}`,
      `/img/desk/nse?size=512&v=discord-${"b".repeat(32)}`,
    ]);
  });

  it("falls back to the defaults when the database cannot be read", async () => {
    holder.ctx = {
      openDb: () => ({
        db: {
          select: () => {
            throw new Error("down");
          },
        },
        close: async () => {},
      }),
    } as unknown as AppContext;
    const m = await manifest();
    expect(m.name).toBe("Officers’ Desk");
    expect(m.icons.map((i) => i.src)).toEqual(["/icon/192", "/icon/512"]);
  });
});
