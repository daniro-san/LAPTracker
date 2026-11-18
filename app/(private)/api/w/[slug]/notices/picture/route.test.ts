// A notice's picture upload (D119): the server checks the bytes itself, whatever the request's content type
// says. A picture that is not WebP, JPEG or PNG, one over 400 KB, one over 1600 px a side or an animated one
// is refused and nothing is stored; a valid PNG or WebP is stored once per notice, and Replace overwrites it.
// An officer of another workspace can neither add nor remove one. A notice in the trash (D118) answers 410
// notice_deleted, so the editor offers to restore it; after the restore the picture goes in.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { apngHeader, pngHeader, webpHeader } from "@/lib/private/notice-picture.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { noticePictures } from "@/lib/schema-notices";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST: save } = await import("../route");
const { POST } = await import("./route");
const { POST: remove } = await import("./remove/route");
const { POST: trash } = await import("../delete/route");

let db: Db;
/** An officer of ogs (workspace 1) and one of nse (workspace 2). */
const tokens = { ogs: "", nse: "" };
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db.insert(workspaces).values([
    { unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] },
    { unionId: 67109944, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] },
  ]);
  holder.ctx = testContext(db).ctx;
  for (const [workspaceId, slug] of [
    [1, "ogs"],
    [2, "nse"],
  ] as const) {
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId, discordUserId: `id-rook-${slug}`, displayName: "Rook" })
      .returning({ id: workspaceUsers.id });
    tokens[slug] = (await createSession(db, workspaceId, user?.id ?? 0, T0, null, "officer")).token;
  }
});

type Slug = keyof typeof tokens;
const headers = (type: string, slug: Slug = "ogs") => ({
  origin: "https://laptracker.test",
  "content-type": type,
  cookie: `${SESSION_COOKIE}=${tokens[slug]}`,
});
const params = (slug: Slug) => ({ params: Promise.resolve({ slug }) });

async function json(route: typeof POST, path: string, body: object, slug: Slug = "ogs") {
  const request = new Request(`https://laptracker.test/api/w/${slug}/notices/${path}`, {
    method: "POST",
    headers: headers("application/json", slug),
    body: JSON.stringify(body),
  });
  const response = await route(request, params(slug));
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

const notice = async () =>
  (
    await json(save, "", {
      requestId: randomUUID(),
      changes: [{ field: "title", value: "Rota", version: 0 }],
    })
  ).json.id as number;

async function upload(id: number, bytes: Uint8Array, type = "image/png", slug: Slug = "ogs") {
  const response = await POST(
    new Request(`https://laptracker.test/api/w/${slug}/notices/picture?id=${id}`, {
      method: "POST",
      headers: { ...headers(type, slug), "content-length": String(bytes.length) },
      body: new Uint8Array(bytes),
    }),
    params(slug),
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

describe("POST /api/w/[slug]/notices/picture", () => {
  it("refuses a file that is not WebP, JPEG or PNG, whatever its content type says", async () => {
    const id = await notice();
    const gif = new TextEncoder().encode("GIF89a\u0001\u0000\u0001\u0000");
    expect(await upload(id, gif, "image/png")).toEqual({
      status: 415,
      json: { code: "wrong_type" },
    });
    expect(await db.select().from(noticePictures)).toEqual([]);
  });

  it("refuses a file over 400 KB, and one over 1600 px a side", async () => {
    const id = await notice();
    const heavy = new Uint8Array(400 * 1024 + 1);
    heavy.set(pngHeader(800, 600));
    expect(await upload(id, heavy)).toEqual({ status: 413, json: { code: "too_large" } });
    expect(await upload(id, pngHeader(1601, 900))).toEqual({
      status: 422,
      json: { code: "too_big_sides" },
    });
    expect(await db.select().from(noticePictures)).toEqual([]);
  });

  it("refuses an animated WebP", async () => {
    const id = await notice();
    expect(await upload(id, webpHeader(400, 300, true), "image/webp")).toEqual({
      status: 422,
      json: { code: "animated" },
    });
    expect(await db.select().from(noticePictures)).toEqual([]);
  });

  it("refuses an animated PNG", async () => {
    const id = await notice();
    expect(await upload(id, apngHeader(400, 300))).toEqual({
      status: 422,
      json: { code: "animated" },
    });
    expect(await db.select().from(noticePictures)).toEqual([]);
  });

  it("stores a valid picture once per notice, and Replace overwrites it", async () => {
    const id = await notice();
    const first = await upload(id, pngHeader(1600, 900));
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ width: 1600, height: 900 });
    expect(String(first.json.src)).toMatch(new RegExp(`^/img/notice/${id}\\?v=[0-9a-f]{16}$`));
    expect((await upload(id, pngHeader(300, 200))).json).toMatchObject({ width: 300, height: 200 });
    const rows = await db.select().from(noticePictures);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ noticeId: id, type: "image/png", width: 300, height: 200 });
  });

  it("stores a WebP", async () => {
    const id = await notice();
    const stored = await upload(id, webpHeader(1200, 1600), "image/webp");
    expect(stored).toMatchObject({ status: 200, json: { width: 1200, height: 1600 } });
    const [row] = await db.select().from(noticePictures);
    expect(row).toMatchObject({ type: "image/webp", bytes: 30 });
  });

  it("lets no officer of another workspace add or remove a picture", async () => {
    const id = await notice();
    expect(await upload(id, pngHeader(40, 30), "image/png", "nse")).toEqual({
      status: 404,
      json: { code: "not_found" },
    });
    expect((await upload(id, pngHeader(40, 30))).status).toBe(200);
    expect((await json(remove, "picture/remove", { id }, "nse")).status).toBe(200);
    expect(await db.select().from(noticePictures)).toHaveLength(1);
  });

  it("answers 410 notice_deleted for a notice in the trash, and takes the picture once it is restored (D118)", async () => {
    const id = await notice();
    expect((await json(trash, "delete", { id, requestId: randomUUID() })).status).toBe(200);
    expect(await upload(id, pngHeader(40, 30))).toEqual({
      status: 410,
      json: { code: "notice_deleted" },
    });
    expect((await json(remove, "picture/remove", { id })).status).toBe(410);
    const restore = { id, requestId: randomUUID(), restore: true };
    expect((await json(trash, "delete", restore)).status).toBe(200);
    expect((await upload(id, pngHeader(40, 30))).status).toBe(200);
    expect(await db.select().from(noticePictures)).toHaveLength(1);
  });
});
