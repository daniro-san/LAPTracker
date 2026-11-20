// GET /img/notice/[id] (D119): the picture only after the notice's own access check. An officer of its
// workspace gets it, with a private cache header and an ETag that answers 304; a member only while the
// members' board shows the notice, so not after its end day. An officer of another workspace and a
// signed-out browser get a 404, and so does everyone after Remove or once the notice is deleted (D118).
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { pngHeader } from "@/lib/private/notice-picture.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";
import { noticePictures } from "@/lib/schema-notices";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST: save } = await import("../../../api/w/[slug]/notices/route");
const { POST: trash } = await import("../../../api/w/[slug]/notices/delete/route");
const { POST: removePicture } = await import("../../../api/w/[slug]/notices/picture/remove/route");
const { POST: upload } = await import("../../../api/w/[slug]/notices/picture/route");
const { GET } = await import("./route");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db.insert(workspaces).values([
    {
      unionId: 67111155,
      slug: "ogs",
      discordGuildId: "1",
      leaderRoleIds: ["2"],
      memberRoleIds: ["3"],
    },
    { unionId: 67109944, slug: "nse", discordGuildId: "4", leaderRoleIds: ["5"] },
  ]);
  holder.ctx = testContext(db).ctx;
});

async function session(workspaceId: number, name: string, tier: "officer" | "member") {
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: `id-${name}`, displayName: name })
    .returning({ id: workspaceUsers.id });
  return (await createSession(db, workspaceId, user?.id ?? 0, T0, null, tier)).token;
}

const at = (path: string, token: string, type = "application/json") => ({
  url: `https://laptracker.test/api/w/ogs/${path}`,
  headers: {
    origin: "https://laptracker.test",
    "content-type": type,
    cookie: `${SESSION_COOKIE}=${token}`,
  },
});
const slug = { params: Promise.resolve({ slug: "ogs" }) };

/** A notice with a picture; `members` sets "Show to members", `endsOn` its end day. */
async function pictured(token: string, members: boolean, endsOn = ""): Promise<number> {
  const changes = [
    { field: "title", value: "Rota", version: 0 },
    { field: "en", value: "Water the roses.", version: 0 },
    { field: "for_members", value: String(members), version: 0 },
    { field: "ends_on", value: endsOn, version: 0 },
  ];
  const made = at("notices", token);
  const body = JSON.stringify({ requestId: randomUUID(), changes });
  const res = await save(new Request(made.url, { method: "POST", ...made, body }), slug);
  const { id } = (await res.json()) as { id: number };
  const put = at(`notices/picture?id=${id}`, token, "image/png");
  const headers = { ...put.headers, "content-length": "33" };
  await upload(new Request(put.url, { method: "POST", headers, body: pngHeader(40, 30) }), slug);
  return id;
}

async function view(id: number, token: string | null, etag?: string, query = "") {
  const headers: Record<string, string> = token ? { cookie: `${SESSION_COOKIE}=${token}` } : {};
  if (etag) headers["if-none-match"] = etag;
  const url = `https://laptracker.test/img/notice/${id}${query}`;
  const res = await GET(new Request(url, { headers }), {
    params: Promise.resolve({ id: String(id) }),
  });
  return { status: res.status, headers: res.headers, bytes: (await res.arrayBuffer()).byteLength };
}

describe("GET /img/notice/[id]", () => {
  it("serves an officer of the workspace privately, with an ETag that answers 304", async () => {
    const officer = await session(1, "Rook", "officer");
    const id = await pictured(officer, false);
    const first = await view(id, officer);
    expect(first).toMatchObject({ status: 200, bytes: 33 });
    expect(first.headers.get("content-type")).toBe("image/png");
    expect(first.headers.get("cache-control")).toBe("private, no-cache");
    const etag = first.headers.get("etag") ?? "";
    expect((await view(id, officer, etag)).status).toBe(304);
  });

  it("serves a member only while the board shows the notice", async () => {
    const officer = await session(1, "Rook", "officer");
    const member = await session(1, "Pip", "member");
    expect((await view(await pictured(officer, true), member)).status).toBe(200);
    expect((await view(await pictured(officer, false), member)).status).toBe(404);
  });

  it("refuses a member once the notice's end day has passed", async () => {
    const officer = await session(1, "Rook", "officer");
    const member = await session(1, "Pip", "member");
    // T0 is 2026-11-07: the board shows a notice through its end day, not after it.
    expect((await view(await pictured(officer, true, "2026-11-07"), member)).status).toBe(200);
    expect((await view(await pictured(officer, true, "2026-11-06"), member)).status).toBe(404);
  });

  it("is gone once Remove takes the picture away", async () => {
    const officer = await session(1, "Rook", "officer");
    const id = await pictured(officer, true);
    const del = at("notices/picture/remove", officer);
    const body = JSON.stringify({ id });
    const removed = await removePicture(
      new Request(del.url, { method: "POST", ...del, body }),
      slug,
    );
    expect(removed.status).toBe(200);
    expect(await db.select().from(noticePictures)).toEqual([]);
    expect((await view(id, officer)).status).toBe(404);
  });

  it("refuses another workspace's officer and a signed-out browser", async () => {
    const id = await pictured(await session(1, "Rook", "officer"), true);
    expect((await view(id, await session(2, "Wren", "officer"))).status).toBe(404);
    expect((await view(id, null)).status).toBe(404);
  });

  it("is gone once the notice is deleted (D118)", async () => {
    const officer = await session(1, "Rook", "officer");
    const member = await session(1, "Pip", "member");
    const id = await pictured(officer, true);
    const del = at("notices/delete", officer);
    const body = JSON.stringify({ id, requestId: randomUUID() });
    expect((await trash(new Request(del.url, { method: "POST", ...del, body }), slug)).status).toBe(
      200,
    );
    expect((await view(id, officer)).status).toBe(404);
    expect((await view(id, member)).status).toBe(404);
  });

  it("sends Download to an officer as a file, and refuses it to a member", async () => {
    const officer = await session(1, "Rook", "officer");
    const member = await session(1, "Pip", "member");
    const id = await pictured(officer, true);
    const saved = await view(id, officer, undefined, "?download=1");
    expect(saved).toMatchObject({ status: 200, bytes: 33 });
    expect(saved.headers.get("content-disposition")).toBe(
      `attachment; filename="notice-${id}.png"`,
    );
    expect(saved.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await view(id, member, undefined, "?download=1")).status).toBe(404);
  });

  it("is a 404 to everyone while notice pictures are turned off, and back once on (D126)", async () => {
    const officer = await session(1, "Rook", "officer");
    const member = await session(1, "Pip", "member");
    const id = await pictured(officer, true);
    await db
      .insert(workspaceFeatures)
      .values({ workspaceId: 1, switches: { notice_pictures: false } });
    expect((await view(id, officer)).status).toBe(404);
    expect((await view(id, member)).status).toBe(404);
    await db.delete(workspaceFeatures);
    expect((await view(id, officer)).status).toBe(200);
  });
});
