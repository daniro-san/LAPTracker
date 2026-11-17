// The notices' save (issues 304, 293): two officers on different fields both persist; on the same field the
// second gets 409 with the first one's text and nothing of theirs is written; another workspace's notice is
// not found.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");

let db: Db;
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
});

/** A signed-in officer of `slug` (workspace 1 is ogs, 2 is nse): their session token. */
async function officer(slug: "ogs" | "nse", name: string): Promise<string> {
  const workspaceId = slug === "ogs" ? 1 : 2;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: `id-${name}`, displayName: name })
    .returning({ id: workspaceUsers.id });
  return (await createSession(db, workspaceId, user?.id ?? 0, T0, null, "officer")).token;
}

async function save(slug: string, token: string, body: object) {
  const response = await POST(
    new Request(`https://laptracker.test/api/w/${slug}/notices`, {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug }) },
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

/** A notice with a title and English text, at version 1 (title) and 2 (en). */
async function notice(token: string): Promise<number> {
  const made = await save("ogs", token, {
    requestId: randomUUID(),
    changes: [
      { field: "title", value: "Queen position", version: 0 },
      { field: "en", value: "Apply for Queen today.", version: 0 },
    ],
  });
  expect(made.status).toBe(200);
  return made.json.id as number;
}

describe("POST /api/w/[slug]/notices", () => {
  it("saves two officers' edits of different fields", async () => {
    const [ana, bia] = [await officer("ogs", "Ana"), await officer("ogs", "Bia")];
    const id = await notice(ana);
    const one = await save("ogs", ana, {
      id,
      changes: [{ field: "title", value: "👑 Queen position", version: 1 }],
    });
    const two = await save("ogs", bia, {
      id,
      changes: [{ field: "en", value: "Apply for Queen today, then pass it on.", version: 2 }],
    });
    expect([one.status, two.status]).toEqual([200, 200]);
  });

  it("refuses a stale write of the same field with 409 and the newer text, and writes nothing", async () => {
    const [ana, bia] = [await officer("ogs", "Ana"), await officer("ogs", "Bia")];
    const id = await notice(ana);
    // Both opened the notice at en version 2; Ana saves first.
    await save("ogs", ana, { id, changes: [{ field: "en", value: "Ana's text", version: 2 }] });
    const late = await save("ogs", bia, {
      id,
      changes: [
        { field: "title", value: "Bia's title", version: 1 },
        { field: "en", value: "Bia's text", version: 2 },
      ],
    });
    expect(late.status).toBe(409);
    expect(late.json).toMatchObject({
      code: "conflict",
      conflicts: [{ field: "en", value: "Ana's text", by: "Ana" }],
    });
    // Bia's title was not written either: the title is still at version 1.
    const retry = await save("ogs", bia, {
      id,
      changes: [{ field: "title", value: "Bia's title", version: 1 }],
    });
    expect(retry.status).toBe(200);
  });

  it("does not find another workspace's notice", async () => {
    const id = await notice(await officer("ogs", "Ana"));
    const outsider = await officer("nse", "Nox");
    const answer = await save("nse", outsider, {
      id,
      changes: [{ field: "title", value: "Taken", version: 1 }],
    });
    expect(answer.status).toBe(404);
  });
});
