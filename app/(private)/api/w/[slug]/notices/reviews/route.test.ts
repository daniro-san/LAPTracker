// Review requests on notices (D113): an officer asks one officer to review PT and the team to review the
// whole notice; who sees which on Home; approve (only the one asked, once); edit and save from the request
// closes it as edited; an answered request refuses a second answer.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { toReviewCount } from "@/lib/private/import-view";
import { noticeReviews, reviewsForMe } from "@/lib/private/notice-reviews";
import { noticeDetail } from "@/lib/private/notices";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");
const { POST: SAVE } = await import("../route");

let db: Db;
const tokens: Record<string, string> = {};
const ids: Record<string, number> = {};
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db
    .insert(workspaces)
    .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  holder.ctx = testContext(db).ctx;
  for (const name of ["Ana", "Rook", "Wren"]) {
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId: 1, discordUserId: `id-${name}`, displayName: name })
      .returning({ id: workspaceUsers.id });
    ids[name] = user?.id ?? 0;
    tokens[name] = (await createSession(db, 1, ids[name], T0, null, "officer")).token;
  }
});

function call(handler: typeof POST, path: string, name: string, body: object) {
  return handler(
    new Request(`https://laptracker.test/api/w/ogs/${path}`, {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${tokens[name]}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );
}

const review = (name: string, body: object) => call(POST, "notices/reviews", name, body);

async function access(name: string) {
  const a = await requireWorkspace(db, "ogs", { get: () => ({ value: tokens[name] ?? "" }) }, T0);
  if (!a.ok) throw new Error("no access");
  return a;
}

/** Ana's notice with English and Portuguese: its id. */
async function notice(): Promise<number> {
  const res = await call(SAVE, "notices", "Ana", {
    requestId: randomUUID(),
    changes: [
      { field: "title", value: "Garden rota", version: 0 },
      { field: "en", value: "Water the beans at 18:00 ST.", version: 0 },
      { field: "pt-BR", value: "Reguem o feijão às 18:00 ST.", version: 0 },
    ],
  });
  return ((await res.json()) as { id: number }).id;
}

describe("review requests on a notice (D113)", () => {
  it("asks one officer or the team, shows each on the right Homes, approves once, and edit-and-save closes", async () => {
    const id = await notice();
    const ask = { action: "ask", notice: id, requestId: randomUUID() };
    // Ana asks Rook to review PT; asking herself is refused; a repeat stores one request.
    const self = await review("Ana", { ...ask, language: "pt-BR", reviewer: ids.Ana });
    expect([self.status, await self.json()]).toEqual([400, { code: "reviewer" }]);
    const toRook = { ...ask, language: "pt-BR", reviewer: ids.Rook };
    const first = (await (await review("Ana", toRook)).json()) as { id: number };
    expect(await (await review("Ana", toRook)).json()).toEqual(first);
    // And the team to review the whole notice.
    const team = { action: "ask", notice: id, language: null, reviewer: null };
    const second = (await (await review("Ana", { ...team, requestId: randomUUID() })).json()) as {
      id: number;
    };

    // Who sees what on Home: Rook both, Wren the team's, Ana (who asked) neither.
    const home = async (name: string) =>
      (await reviewsForMe(db, await access(name))).map((r) => [r.title, r.language, r.askedBy]);
    expect(await home("Rook")).toEqual([
      ["Garden rota", null, "Ana"],
      ["Garden rota", "pt-BR", "Ana"],
    ]);
    expect(await home("Wren")).toEqual([["Garden rota", null, "Ana"]]);
    expect(await home("Ana")).toEqual([]);
    // The Home tab's number counts them too, never one the viewer asked for.
    const tab = async (name: string) => toReviewCount(db, await access(name), T0);
    expect([await tab("Rook"), await tab("Wren"), await tab("Ana")]).toEqual([2, 1, 0]);

    // Only Rook approves Rook's request; a repeat of his tap is the same answer.
    const approve = { action: "approve", review: first.id, requestId: randomUUID() };
    expect((await review("Wren", approve)).status).toBe(403);
    expect((await review("Rook", approve)).status).toBe(200);
    expect((await review("Rook", approve)).status).toBe(200);

    // Wren edits PT from the team's request and saves: the save counts and the request closes as edited.
    const pt = (await noticeDetail(db, await access("Wren"), id))?.fields["pt-BR"].version ?? 0;
    const saved = await call(SAVE, "notices", "Wren", {
      id,
      changes: [{ field: "pt-BR", value: "Reguem o feijão às 18:00 ST, por favor.", version: pt }],
      review: { id: second.id, requestId: randomUUID() },
    });
    expect(saved.status).toBe(200);
    const late = { action: "approve", review: second.id, requestId: randomUUID() };
    expect([(await review("Rook", late)).status]).toEqual([409]);

    // The notice shows both outcomes, with who; nothing is left open on any Home.
    const { list } = await noticeReviews(db, await access("Ana"), id);
    expect(list.map((r) => [r.language, r.outcome?.kind, r.outcome?.by, r.mine])).toEqual([
      [null, "edited", "Wren", false],
      ["pt-BR", "approved", "Rook", false],
    ]);
    for (const name of ["Ana", "Rook", "Wren"]) expect(await home(name)).toEqual([]);
  });
});
