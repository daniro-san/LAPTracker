// Review requests on notices (D113), one behaviour per test: asking (once per request id, never yourself,
// never a blocked officer or one of another workspace, never another workspace's notice); who sees which on
// Home and in the tab's number; approving (only the one asked, once); edit and save from a request, which
// closes it in the save's transaction, and the saves that leave it open.
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { recentActivity } from "@/lib/private/desk-activity.test-helpers";
import { toReviewCount } from "@/lib/private/import-view";
import { noticeReviews, reviewsForMe } from "@/lib/private/notice-reviews";
import { noticeDetail } from "@/lib/private/notices";
import { UNDO_MS } from "@/lib/private/roll-call";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { unzip } from "@/lib/zip.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");
const { POST: SAVE } = await import("../route");
const { POST: EXPORT } = await import("../../data-export/route");

let db: Db;
const tokens: Record<string, string> = {};
const ids: Record<string, number> = {};
let clock: { now: Date };
const SLUG_OF: Record<string, string> = { Ana: "ogs", Rook: "ogs", Wren: "ogs", Nia: "nse" };

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db.insert(workspaces).values([
    { unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] },
    { unionId: 67109944, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] },
  ]);
  const context = testContext(db);
  holder.ctx = context.ctx;
  clock = context.clock;
  for (const name of ["Ana", "Rook", "Wren", "Nia"]) {
    const workspaceId = SLUG_OF[name] === "ogs" ? 1 : 2;
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId, discordUserId: `id-${name}`, displayName: name })
      .returning({ id: workspaceUsers.id });
    ids[name] = user?.id ?? 0;
    tokens[name] = (await createSession(db, workspaceId, ids[name], T0, null, "officer")).token;
  }
});

function call(handler: typeof POST, path: string, name: string, body: object) {
  const slug = SLUG_OF[name] ?? "ogs";
  return handler(
    new Request(`https://laptracker.test/api/w/${slug}/${path}`, {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${tokens[name]}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug }) },
  );
}

const review = (name: string, body: object) => call(POST, "notices/reviews", name, body);

async function access(name: string) {
  const a = await requireWorkspace(
    db,
    SLUG_OF[name] ?? "ogs",
    { get: () => ({ value: tokens[name] ?? "" }) },
    T0,
  );
  if (!a.ok) throw new Error("no access");
  return a;
}

/** A notice with English and Portuguese, written by `name`: its id. */
async function notice(name = "Ana"): Promise<number> {
  const res = await call(SAVE, "notices", name, {
    requestId: randomUUID(),
    changes: [
      { field: "title", value: "Garden rota", version: 0 },
      { field: "en", value: "Water the beans at 18:00 ST.", version: 0 },
      { field: "pt-BR", value: "Reguem o feijão às 18:00 ST.", version: 0 },
    ],
  });
  return ((await res.json()) as { id: number }).id;
}

/** Ana asks: `reviewer` null for the team, `language` null for the whole notice. Its id. */
async function ask(id: number, language: string | null, reviewer: number | null) {
  const body = { action: "ask", notice: id, language, reviewer, requestId: randomUUID() };
  return ((await (await review("Ana", body)).json()) as { id: number }).id;
}

const home = async (name: string) =>
  (await reviewsForMe(db, await access(name))).map((r) => [r.title, r.language, r.askedBy]);

const isOpen = async (id: number, reviewId: number) =>
  (await noticeReviews(db, await access("Ana"), id)).list.find((r) => r.id === reviewId)
    ?.outcome === null;

/** Saves PT from a request; `version` defaults to the current one. */
async function saveFrom(name: string, id: number, reviewId: number, version?: number) {
  const current = (await noticeDetail(db, await access(name), id))?.fields["pt-BR"].version ?? 0;
  return call(SAVE, "notices", name, {
    id,
    changes: [
      { field: "pt-BR", value: `Reguem às 18:00 ST (${name}).`, version: version ?? current },
    ],
    review: { id: reviewId, requestId: randomUUID() },
  });
}

describe("asking for a review (D113)", () => {
  it("stores one request per request id", async () => {
    const id = await notice();
    const body = {
      action: "ask",
      notice: id,
      language: "pt-BR",
      reviewer: ids.Rook,
      requestId: randomUUID(),
    };
    const first = await (await review("Ana", body)).json();
    expect(await (await review("Ana", body)).json()).toEqual(first);
    expect((await noticeReviews(db, await access("Ana"), id)).list).toHaveLength(1);
  });

  it("refuses yourself, a blocked officer and another workspace's officer as reviewer (400)", async () => {
    const id = await notice();
    await db
      .update(workspaceUsers)
      .set({ blocked: true })
      .where(eq(workspaceUsers.id, ids.Wren ?? 0));
    for (const reviewer of [ids.Ana, ids.Wren, ids.Nia]) {
      const body = { action: "ask", notice: id, language: null, reviewer, requestId: randomUUID() };
      const res = await review("Ana", body);
      expect([res.status, await res.json()]).toEqual([400, { code: "reviewer" }]);
    }
  });

  it("does not find another workspace's notice or request (404)", async () => {
    const theirs = await notice("Nia");
    const body = {
      action: "ask",
      notice: theirs,
      language: null,
      reviewer: null,
      requestId: randomUUID(),
    };
    expect((await review("Ana", body)).status).toBe(404);
    const theirsAsk = (await (
      await review("Nia", { ...body, requestId: randomUUID() })
    ).json()) as { id: number };
    const approve = { action: "approve", review: theirsAsk.id, requestId: randomUUID() };
    expect((await review("Rook", approve)).status).toBe(404);
  });
});

describe("who sees a request (D113)", () => {
  it("shows a named request to that officer, a team one to all but the asker, on Home and in the tab number", async () => {
    const id = await notice();
    await ask(id, "pt-BR", ids.Rook ?? 0);
    await ask(id, null, null);
    expect(await home("Rook")).toEqual([
      ["Garden rota", null, "Ana"],
      ["Garden rota", "pt-BR", "Ana"],
    ]);
    expect(await home("Wren")).toEqual([["Garden rota", null, "Ana"]]);
    expect(await home("Ana")).toEqual([]);
    const tab = async (name: string) => toReviewCount(db, await access(name), T0);
    expect([await tab("Rook"), await tab("Wren"), await tab("Ana")]).toEqual([2, 1, 0]);
  });
});

describe("answering a request (D113)", () => {
  it("lets only the officer asked approve, once per request id; a later answer gets 409", async () => {
    const id = await notice();
    const toRook = await ask(id, "pt-BR", ids.Rook ?? 0);
    const approve = { action: "approve", review: toRook, requestId: randomUUID() };
    expect((await review("Wren", approve)).status).toBe(403);
    expect((await review("Rook", approve)).status).toBe(200);
    expect((await review("Rook", approve)).status).toBe(200);
    const late = await review("Rook", { ...approve, requestId: randomUUID() });
    expect([late.status, await late.json()]).toEqual([409, { code: "closed" }]);
    expect(await home("Rook")).toEqual([]);
  });

  it("closes a request as edited when its reviewer saves from it", async () => {
    const id = await notice();
    const toTeam = await ask(id, null, null);
    expect((await saveFrom("Wren", id, toTeam)).status).toBe(200);
    const { list } = await noticeReviews(db, await access("Ana"), id);
    expect(list.map((r) => [r.outcome?.kind, r.outcome?.by])).toEqual([["edited", "Wren"]]);
  });

  it("leaves the request open when the save is refused with 409", async () => {
    const id = await notice();
    const toRook = await ask(id, "pt-BR", ids.Rook ?? 0);
    const res = await saveFrom("Rook", id, toRook, 1);
    expect(res.status).toBe(409);
    expect(await isOpen(id, toRook)).toBe(true);
  });

  it("saves from a request the officer may not answer, and leaves that request open", async () => {
    const id = await notice();
    const toRook = await ask(id, "pt-BR", ids.Rook ?? 0);
    const res = await saveFrom("Wren", id, toRook);
    expect(res.status).toBe(200);
    expect(await isOpen(id, toRook)).toBe(true);
    expect((await noticeDetail(db, await access("Ana"), id))?.fields["pt-BR"].value).toBe(
      "Reguem às 18:00 ST (Wren).",
    );
  });
});

describe("withdrawing a review request (D123 phase 2)", () => {
  const withdraw = (name: string, review: number, requestId: string, undo?: true) =>
    call(POST, "notices/reviews", name, {
      action: "withdraw",
      review,
      requestId,
      ...(undo && { undo }),
    });

  it("any officer withdraws an open one: it leaves the notice, To review, the tab's number, Home's lines and the download's main file", async () => {
    const id = await notice();
    const r = await ask(id, null, null);
    const tab = async () => toReviewCount(db, await access("Rook"), T0);
    expect([(await home("Rook")).length, await tab()]).toEqual([1, 1]);
    expect((await withdraw("Rook", r, randomUUID())).status).toBe(200);
    expect((await noticeReviews(db, await access("Ana"), id)).list).toEqual([]);
    expect([(await home("Rook")).length, await tab()]).toEqual([0, 0]);
    const approve = { action: "approve", review: r, requestId: randomUUID() };
    expect((await review("Rook", approve)).status).toBe(404);
    const kinds = (await recentActivity(db, await access("Wren"), T0)).map((l) => l.item.kind);
    expect([kinds.includes("reviewWithdrawn"), kinds.includes("reviewAsked")]).toEqual([
      true,
      false,
    ]);
    const res = await call(EXPORT, "data-export", "Ana", { requestId: randomUUID() });
    const files = unzip(new Uint8Array(await res.arrayBuffer()));
    const rows = (name: string) => (files.get(name)?.toString("utf8") ?? "").trim().split("\r\n");
    expect([rows("notice-reviews.csv").length, rows("notice-reviews-deleted.csv").length]).toEqual([
      1, 2,
    ]);
  });

  it("refuses a signed-out request (401), another workspace's officer and an answered request (404)", async () => {
    const id = await notice();
    const r = await ask(id, null, null);
    expect((await withdraw("Nobody", r, randomUUID())).status).toBe(401);
    expect((await withdraw("Nia", r, randomUUID())).status).toBe(404);
    await review("Rook", { action: "approve", review: r, requestId: randomUUID() });
    expect((await withdraw("Rook", r, randomUUID())).status).toBe(404);
    expect(await isOpen(id, r)).toBe(false);
  });

  it("Undo is the withdrawer's own, within UNDO_MS", async () => {
    const id = await notice();
    const r = await ask(id, null, null);
    const requestId = randomUUID();
    await withdraw("Rook", r, requestId);
    expect((await withdraw("Ana", r, requestId, true)).status).toBe(404);
    expect((await withdraw("Rook", r, requestId, true)).status).toBe(200);
    expect(await isOpen(id, r)).toBe(true);
    const late = randomUUID();
    await withdraw("Rook", r, late);
    clock.now = new Date(T0.getTime() + UNDO_MS + 1);
    expect((await withdraw("Rook", r, late, true)).status).toBe(404);
    expect(await isOpen(id, r)).toBe(false);
  });
});
