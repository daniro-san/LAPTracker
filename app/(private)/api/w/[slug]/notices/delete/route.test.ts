// Deleting a notice (issue 411, D118), one behaviour per test: a delete takes the notice out of every list
// (the library, the page, the members' board, the calendar's titles, review requests) and a repeat of the
// same request changes nothing; a member's session cannot delete; another workspace cannot; Undo by the
// officer who deleted brings it back, and only theirs, only for a while; Home's activity says who deleted it.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireBoard, requireWorkspace } from "@/lib/private/access";
import { boardView } from "@/lib/private/board";
import { feedLine } from "@/lib/private/desk-activity-words";
import { recentActivity } from "@/lib/private/desk-activity.test-helpers";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { toReviewCount } from "@/lib/private/import-view";
import { publishNotice } from "@/lib/private/notice-publish";
import { reviewsForMe } from "@/lib/private/notice-reviews";
import { noticeDetail, noticesList, titlesOf, UNDO_MS } from "@/lib/private/notices";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");
const { POST: SAVE } = await import("../route");
const { POST: REVIEW } = await import("../reviews/route");

let db: Db;
let clock: { now: Date };
const tokens: Record<string, string> = {};
const SLUG_OF: Record<string, string> = { Ana: "ogs", Rook: "ogs", Bree: "ogs", Nia: "nse" };

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db.insert(workspaces).values([
    { unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] },
    { unionId: 67109944, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] },
  ]);
  const made = testContext(db);
  holder.ctx = made.ctx;
  clock = made.clock;
  for (const name of ["Ana", "Rook", "Bree", "Nia"]) {
    const workspaceId = SLUG_OF[name] === "ogs" ? 1 : 2;
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId, discordUserId: `id-${name}`, displayName: name })
      .returning({ id: workspaceUsers.id });
    // Bree is a regular member, on the members' board (D105).
    const tier = name === "Bree" ? "member" : "officer";
    tokens[name] = (await createSession(db, workspaceId, user?.id ?? 0, T0, null, tier)).token;
  }
});

function call(handler: typeof POST, path: string, name: string, body: object, slug?: string) {
  const to = slug ?? SLUG_OF[name] ?? "ogs";
  return handler(
    new Request(`https://laptracker.test/api/w/${to}/${path}`, {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${tokens[name]}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: to }) },
  );
}

const remove = (name: string, body: object, slug?: string) =>
  call(POST, "notices/delete", name, body, slug);

const cookies = (name: string) => ({ get: () => ({ value: tokens[name] ?? "" }) });

async function access(name: string) {
  const a = await requireWorkspace(db, SLUG_OF[name] ?? "ogs", cookies(name), T0);
  if (!a.ok) throw new Error("no access");
  return a;
}

/** A members notice in English, written by Ana: its id. */
async function notice(): Promise<number> {
  const res = await call(SAVE, "notices", "Ana", {
    requestId: randomUUID(),
    changes: [
      { field: "title", value: "Test notice", version: 0 },
      { field: "en", value: "Ignore this one.", version: 0 },
      { field: "for_members", value: "true", version: 0 },
    ],
  });
  return ((await res.json()) as { id: number }).id;
}

/** Where the notice can be seen: the library, its page, the board, the calendar's title, Rook's To review. */
async function seenIn(id: number) {
  const a = await access("Ana");
  const board = await requireBoard(db, "ogs", cookies("Ana"), T0);
  if (!("officer" in board)) throw new Error("no board");
  return {
    list: (await noticesList(db, a)).some((n) => n.id === id),
    page: (await noticeDetail(db, a, id)) !== null,
    board: (await boardView(db, board, "2026-11-17")).notices.some((n) => n.id === id),
    calendar: (await titlesOf(db, a, [id])).has(id),
    review: (await reviewsForMe(db, await access("Rook"))).some((r) => r.noticeId === id),
    /** The Home tab's number for Rook (D113): only this notice's request can count. */
    count: (await toReviewCount(db, await access("Rook"), T0)) > 0,
  };
}

const NAMES = { en: "English", "pt-BR": "Português", fr: "Français" };

const EVERYWHERE = {
  list: true,
  page: true,
  board: true,
  calendar: true,
  review: true,
  count: true,
};
const NOWHERE = {
  list: false,
  page: false,
  board: false,
  calendar: false,
  review: false,
  count: false,
};

/** Rook's activity lines on Home, in English. */
const lines = async () =>
  (await recentActivity(db, await access("Rook"), clock.now)).map((line) =>
    feedLine(line, WORKSPACE_DICTIONARIES.en, "en"),
  );

describe("deleting a notice (D118)", () => {
  it("takes it out of every list, once per request id", async () => {
    const id = await notice();
    const ask = {
      action: "ask",
      notice: id,
      language: null,
      reviewer: null,
      requestId: randomUUID(),
    };
    await call(REVIEW, "notices/reviews", "Ana", ask);
    expect(await seenIn(id)).toEqual(EVERYWHERE);
    const requestId = randomUUID();
    expect((await remove("Ana", { id, requestId })).status).toBe(200);
    expect(await seenIn(id)).toEqual(NOWHERE);
    // A repeat of the same request answers as the first; another delete finds nothing to delete.
    expect((await remove("Ana", { id, requestId })).status).toBe(200);
    expect((await remove("Rook", { id, requestId: randomUUID() })).status).toBe(404);
    // Nor is it published: refused before the channel (none is set up here) is even looked at.
    const deps = { fetch, now: T0, channels: { members: null, leaders: null }, names: NAMES };
    const input = { id, languages: ["en" as const], requestId: randomUUID() };
    const published = await publishNotice(db, await access("Ana"), input, deps);
    expect(published).toEqual({ ok: false, code: "not_found" });
  });

  it("is refused to a member's session with 401 signed_out", async () => {
    const id = await notice();
    const res = await remove("Bree", { id, requestId: randomUUID() });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "signed_out" });
    expect((await seenIn(id)).list).toBe(true);
  });

  it("is refused to another workspace", async () => {
    const id = await notice();
    // Nia's own workspace has no such notice; her session does not open Ana's workspace.
    expect((await remove("Nia", { id, requestId: randomUUID() })).status).toBe(404);
    expect((await remove("Nia", { id, requestId: randomUUID() }, "ogs")).status).toBe(401);
    // No review was asked here.
    expect(await seenIn(id)).toEqual({ ...EVERYWHERE, review: false, count: false });
  });

  it("comes back with the deleter's Undo, only theirs and only for a while", async () => {
    const id = await notice();
    const requestId = randomUUID();
    await remove("Ana", { id, requestId });
    // Rook did not delete it; a request id that is not the delete's undoes nothing.
    expect((await remove("Rook", { id, requestId, undo: true })).status).toBe(404);
    expect((await remove("Ana", { id, requestId: randomUUID(), undo: true })).status).toBe(404);
    expect((await remove("Ana", { id, requestId, undo: true })).status).toBe(200);
    expect((await seenIn(id)).list).toBe(true);
    // Deleted again, Undo after UNDO_MS is too late.
    const later = randomUUID();
    await remove("Ana", { id, requestId: later });
    clock.now = new Date(T0.getTime() + UNDO_MS + 1);
    expect((await remove("Ana", { id, requestId: later, undo: true })).status).toBe(404);
    expect((await seenIn(id)).list).toBe(false);
  });

  it("shows on Home as who deleted which notice, and not once undone", async () => {
    const id = await notice();
    const requestId = randomUUID();
    clock.now = new Date(T0.getTime() + 60_000);
    await remove("Ana", { id, requestId });
    expect((await lines())[0]).toBe("⁨Ana⁩ deleted the notice “⁨Test notice⁩”");
    await remove("Ana", { id, requestId, undo: true });
    expect((await lines()).some((l) => l.includes("deleted"))).toBe(false);
  });

  it("does not delete again when its request is replayed after Undo", async () => {
    const id = await notice();
    const requestId = randomUUID();
    await remove("Ana", { id, requestId });
    await remove("Ana", { id, requestId, undo: true });
    clock.now = new Date(T0.getTime() + 60_000);
    // A late retry of the first delete (a lost answer, a back-and-forward) answers as it did, and writes nothing.
    expect((await remove("Ana", { id, requestId })).status).toBe(200);
    expect((await seenIn(id)).list).toBe(true);
    expect((await lines()).some((l) => l.includes("deleted"))).toBe(false);
  });
});

describe("restoring a notice from the trash (D118)", () => {
  const save = (id: number, value: string) =>
    call(SAVE, "notices", "Rook", { id, changes: [{ field: "en", value, version: 0 }] });

  it("a save to a deleted notice answers 410 notice_deleted, to an unknown one 404", async () => {
    const id = await notice();
    await remove("Ana", { id, requestId: randomUUID() });
    const res = await save(id, "Rook's text.");
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ code: "notice_deleted" });
    expect((await save(id + 100, "Elsewhere.")).status).toBe(404);
  });

  it("is open to another officer after the Undo window, recorded, and then the save goes through", async () => {
    const id = await notice();
    await remove("Ana", { id, requestId: randomUUID() });
    clock.now = new Date(T0.getTime() + UNDO_MS + 60_000);
    const requestId = randomUUID();
    expect((await remove("Rook", { id, requestId, restore: true })).status).toBe(200);
    // A repeat of the same restore changes nothing; a restore of a live notice finds nothing to restore.
    expect((await remove("Rook", { id, requestId, restore: true })).status).toBe(200);
    expect((await remove("Rook", { id, requestId: randomUUID(), restore: true })).status).toBe(404);
    expect((await seenIn(id)).list).toBe(true);
    expect((await lines())[0]).toBe("⁨Rook⁩ restored the notice “⁨Test notice⁩”");
    // The officer's text, kept in the editor, now saves.
    const version = (await noticeDetail(db, await access("Rook"), id))?.fields.en.version ?? 0;
    const saved = await call(SAVE, "notices", "Rook", {
      id,
      changes: [{ field: "en", value: "Rook's text.", version }],
    });
    expect(saved.status).toBe(200);
  });
});
