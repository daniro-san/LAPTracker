// A notice's picture upload (D119): the server checks the bytes itself, whatever the request's content type
// says. A picture that is not WebP, JPEG or PNG, one over 400 KB or one over 1600 px a side is refused and
// nothing is stored; a valid one is stored once per notice, and Replace overwrites it.
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
import { noticePictures } from "@/lib/schema-notices";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST: save } = await import("../route");
const { POST } = await import("./route");

let db: Db;
let token: string;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db
    .insert(workspaces)
    .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  holder.ctx = testContext(db).ctx;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: 1, discordUserId: "id-rook", displayName: "Rook" })
    .returning({ id: workspaceUsers.id });
  token = (await createSession(db, 1, user?.id ?? 0, T0, null, "officer")).token;
});

const headers = (type: string) => ({
  origin: "https://laptracker.test",
  "content-type": type,
  cookie: `${SESSION_COOKIE}=${token}`,
});

async function notice(): Promise<number> {
  const body = {
    requestId: randomUUID(),
    changes: [{ field: "title", value: "Rota", version: 0 }],
  };
  const response = await save(
    new Request("https://laptracker.test/api/w/ogs/notices", {
      method: "POST",
      headers: headers("application/json"),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );
  return ((await response.json()) as { id: number }).id;
}

async function upload(id: number, bytes: Uint8Array, type = "image/png") {
  const response = await POST(
    new Request(`https://laptracker.test/api/w/ogs/notices/picture?id=${id}`, {
      method: "POST",
      headers: headers(type),
      body: new Uint8Array(bytes),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
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
});
