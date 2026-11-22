// Issue 471: Alpha's officer sends every write the desk has, under Alpha's own address, naming Bravo's
// records: Bravo's ids in the body, the path and the query, Bravo's request ids (D100) and its trash request
// ids (D123). Each one is refused at Bravo's record, not one of Bravo's rows changes, nothing is posted to
// Discord and no analytics event names Bravo. Alpha's adds under Bravo's request ids make Alpha's own
// records. Invented names only.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import type { Db } from "@/lib/db";
import { openTestDb } from "@/lib/db.test-helpers";
import { pngHeader } from "@/lib/private/notice-picture.test-helpers";
import { ownedRows } from "@/lib/workspace-data.test-helpers";

import {
  ALPHA,
  type Ask,
  BRAVO,
  call,
  eventWorkspaces,
  type Ids,
  idsOf,
  SEED_AT,
  seedTwo,
  theft,
  type Two,
  used,
  WEEK,
} from "./cross-workspace.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

let db: Db;
let two: Two;
let b: Ids;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  two = await seedTwo(db, holder);
  b = await idsOf(db, "bravo");
});

type Step = [string, Ask];
const id = () => randomUUID();

/** Alpha's officer, under Alpha's address, naming Bravo's records. `ours`: a notice of Alpha's. */
function attacks(ours: number): Step[] {
  const [entry = 0] = b.entries;
  const [seeded = 0, added = 0] = b.notices;
  const [call0 = 0] = b.calls;
  const change = { field: "notes", value: "Taken", version: 1 };
  const fact = { ...change, source: "officer" };
  const trash = { scope: "all", week: WEEK, requestId: used.deleted, undo: true };
  return [
    ["calendar", { body: { action: "edit", entry, week: null, changes: [change] } }],
    ["calendar", { body: { action: "delete", entry, scope: "all", week: WEEK, requestId: id() } }],
    ...b.deletedEntries.map((e): Step => [
      "calendar",
      { body: { action: "delete", entry: e, ...trash } },
    ]),
    ...[{ id: call0 }, { entry, week: WEEK }].flatMap((occasion): Step[] => [
      ["roll-call", { body: { action: "mark", occasion, uid: 202, mark: "yes", version: 0 } }],
      ["roll-call", { body: { action: "rest", occasion, uids: [202] } }],
      ["roll-call", { body: { action: "undo", occasion, items: [{ uid: 101, version: 1 }] } }],
      ["roll-call", { body: { action: "team", occasion, uids: [202], on: true } }],
      // D137: Raid prep's squads off the wall, and "Accept the tracker's".
      [
        "roll-call",
        { body: { action: "mark", occasion, uid: 202, mark: "yes", version: 0, part: "wall" } },
      ],
      ["roll-call", { body: { action: "accept", occasion, uids: [202] } }],
      // D137 (2026-11-21): "Checked" on the tracker's marks.
      ["roll-call", { body: { action: "check", occasion, seen: SEED_AT.getTime() } }],
    ]),
    ["roll-call", { body: { action: "delete", id: call0, requestId: id() } }],
    ["roll-call", { body: { action: "archive", id: call0, on: true } }],
    ...b.thefts.flatMap((t): Step[] => [
      ["thefts", { body: { action: "remove", id: t, requestId: id() } }],
      ["thefts", { body: { action: "remove", id: t, requestId: used.deleted, undo: true } }],
    ]),
    ...b.pending.flatMap((p): Step[] => [
      ["pending", { body: { action: "delete", uid: -p, requestId: id() } }],
      ["pending", { body: { action: "delete", uid: -p, requestId: used.deleted, undo: true } }],
      ["pending", { body: { action: "link", uid: -p, to: 101 } }],
      ["facts", { params: { uid: String(-p) }, body: { changes: [fact] } }],
    ]),
    // Bravo's member, 202: its facts, its card, a follow-up, and Bravo's follow-ups' Undo.
    ["facts", { params: { uid: "202" }, body: { changes: [{ ...fact, version: 0 }] } }],
    ["member", { params: { uid: "202" } }],
    [
      "follow-up",
      { body: { uid: 202, action: "talked", note: "", until: null, version: 0, requestId: id() } },
    ],
    ...b.follow.map((target): Step => [
      "follow-up",
      { body: { uid: 202, action: "undo", target, requestId: id() } },
    ]),
    ["garrison", { body: { action: "enemy", entry, week: WEEK, version: 0, value: 5000 } }],
    ["garrison", { body: { action: "save", entry, week: WEEK, rev: 0, pairs: [] } }],
    ["garrison", { body: { action: "post", entry, week: WEEK, requestId: id() } }],
    ...b.notices.flatMap((n): Step[] => [
      ["notices", { body: { id: n, changes: [{ field: "title", value: "Taken", version: 1 }] } }],
      ["notices/delete", { body: { id: n, requestId: id() } }],
      ["notices/delete", { body: { id: n, requestId: id(), restore: true } }],
      ["notices/picture", { query: `?id=${n}`, picture: pngHeader(10, 10) }],
      ["notices/picture/keep", { body: { id: n, keep: true } }],
      ["notices/publish", { body: { id: n, languages: ["en"], requestId: id() } }],
      [
        "notices/reviews",
        { body: { action: "ask", notice: n, language: null, reviewer: null, requestId: id() } },
      ],
    ]),
    // Bravo's picture copied into a notice of Alpha's, and Alpha's into one of Bravo's.
    ["notices/picture/reuse", { body: { from: seeded, to: ours } }],
    ["notices/picture/reuse", { body: { from: ours, to: added } }],
    ...b.reviews.map((review): Step => [
      "notices/reviews",
      { body: { action: "approve", review, requestId: id() } },
    ]),
    // Alpha's own notice, sent for review to Bravo's officer.
    [
      "notices/reviews",
      {
        body: { action: "ask", notice: ours, language: null, reviewer: b.officer, requestId: id() },
      },
    ],
    ...b.drafts.flatMap((d): Step[] => [
      ["shot", { params: { id: String(d) }, body: { action: "discard", version: 1 } }],
      [
        "shot",
        {
          params: { id: String(d) },
          body: { action: "retype", version: 1, kind: "might", scope: null },
        },
      ],
    ]),
    ...b.shares.map((s): Step => ["thanks", { body: { action: "take_down", id: s } }]),
    ["profile", { body: { action: "link", uid: 202 } }],
    [
      "import",
      { body: { csv: "#,Name\n1,Bea Invented", apply: true, decisions: [{ line: 1, uid: 202 }] } },
    ],
    // Bravo's address typed into Alpha's "Delete this workspace".
    ["workspace-deletion", { body: { action: "ask", address: "bravo", requestId: id() } }],
  ];
}

describe("Alpha's officer naming Bravo's records (issue 471)", () => {
  it("is refused every time, and not one of Bravo's rows changes", async () => {
    const [ours = 0] = (await idsOf(db, "alpha")).notices;
    const before = await ownedRows(db, b.workspace);
    for (const [route, ask] of attacks(ours)) {
      const res = await call(two, route, ask);
      const said = `${route} ${JSON.stringify(ask.body ?? ask.query ?? ask.params)}`;
      expect(res.status, said).toBeGreaterThanOrEqual(400);
      expect(res.status, said).toBeLessThan(500);
      // Each request passed its own checks and was refused at Bravo's record, not before it.
      const early = ["bad_request", "wrong_type", "turned_off", "signed_out"];
      expect(early, said).not.toContain(res.json.code);
    }
    // Removing a picture that is not there answers ok (a retry after a lost answer); nothing is removed.
    for (const n of b.notices) {
      expect((await call(two, "notices/picture/remove", { body: { id: n } })).status).toBe(200);
    }
    expect(await ownedRows(db, b.workspace)).toEqual(before);
    // One write of Alpha's own: once its event is sent, one a refusal had queued would be too.
    expect((await call(two, "features", { body: { feature: "thefts", on: false } })).status).toBe(
      200,
    );
    await vi.waitFor(() => expect(eventWorkspaces(two)).toEqual(["ws_action:alpha"]));
    // The one post is that write's own analytics batch: nothing went to Discord, and no refusal was
    // counted (D115).
    expect(two.posts).toHaveLength(1);
  });

  it("under Bravo's request ids, makes Alpha's own records and leaves Bravo's", async () => {
    const before = await ownedRows(db, b.workspace);
    const add = (route: string, body: unknown) => call(two, route, { body });
    const entry = { kind: "other", title: "Alpha plan", day: "2026-11-19", minute: 600 };
    const title = [{ field: "title", value: "Alpha rules", version: 0 }];
    const added = [
      await add("calendar", { action: "create", entry, requestId: used.entry }),
      await add("roll-call", {
        action: "add",
        kind: "cheese",
        day: "2026-11-18",
        requestId: used.call,
      }),
      await add("notices", { changes: title, requestId: used.notice }),
      await add("pending", {
        action: "add",
        requestId: used.pending,
        name: "Bryn Later",
        changes: [],
      }),
      await add("thefts", theft(used.theft)),
    ];
    expect(added.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const review = await add("notices/reviews", {
      action: "ask",
      notice: added[2]?.json.id,
      language: null,
      reviewer: null,
      requestId: used.review,
    });
    expect(review.status).toBe(200);
    // Each id answered is a new record of Alpha's, never one of Bravo's.
    const a = await idsOf(db, "alpha");
    expect(a.entries).toContain(added[0]?.json.id);
    expect(a.calls).toContain(added[1]?.json.id);
    expect(a.notices).toContain(added[2]?.json.id);
    expect(a.pending).toContain(-(added[3]?.json.uid as number));
    expect(a.reviews).toContain(review.json.id);
    // The two seeded thefts and the one just added.
    expect(a.thefts).toHaveLength(3);
    expect(await ownedRows(db, b.workspace)).toEqual(before);
    // Each write is counted for Alpha, and none for Bravo (issue 452).
    await vi.waitFor(() => expect(eventWorkspaces(two)).toHaveLength(6));
    expect(new Set(eventWorkspaces(two))).toEqual(new Set(["ws_action:alpha"]));
  });

  it("turns Alpha's own features on or off, never Bravo's (D134)", async () => {
    const before = await ownedRows(db, b.workspace);
    const off = { body: { feature: "thefts", on: false } };
    expect((await call(two, "features", off)).status).toBe(200);
    // Alpha's officer's session sent to Bravo's address is no session there.
    const alphaEverywhere = { ...two, token: { alpha: two.token.alpha, bravo: two.token.alpha } };
    const there = await call(alphaEverywhere, "features", { ...off, who: "bravo" });
    expect([there.status, there.json.code]).toEqual([401, "signed_out"]);
    expect(await ownedRows(db, b.workspace)).toEqual(before);
    const alpha = await idsOf(db, "alpha");
    expect(await ownedRows(db, alpha.workspace)).toMatchObject({
      workspace_features: [{ allianceSwitches: expect.objectContaining({ thefts: false }) }],
    });
    await vi.waitFor(() => expect(eventWorkspaces(two)).toEqual(["ws_action:alpha"]));
  });

  it("cannot save a webhook of Bravo's server, and Check asks about Alpha's server only (D129)", async () => {
    const ctx = holder.ctx as AppContext;
    Object.assign(ctx.env, {
      WORKSPACE_KEYS_SECRET: Buffer.alloc(32, 5).toString("base64"),
      DISCORD_CLIENT_ID: "900000000000000505",
      DISCORD_CLIENT_SECRET: "client-secret-for-tests",
      DISCORD_BOT_TOKEN: "bot-token-for-tests-only",
    });
    const asked: string[] = [];
    // Discord's stub: every webhook belongs to Bravo's server; the bot is in no server.
    ctx.fetch = async (input) => {
      asked.push(String(input));
      if (String(input).includes("/webhooks/")) return Response.json({ guild_id: String(BRAVO) });
      return new Response("", { status: 403 });
    };
    const before = await ownedRows(db, b.workspace);
    const url = `https://discord.com/api/webhooks/900000000000000303/${"bravo-test-".repeat(3)}`;
    const save = { action: "webhook", channel: "members", url, name: "x", forum: false };
    const saved = await call(two, "discord", { body: { ...save, requestId: randomUUID() } });
    expect([saved.status, saved.json.code]).toEqual([422, "wrong_server"]);
    const checked = await call(two, "discord", { body: { action: "check" } });
    expect([checked.status, checked.json.code]).toEqual([409, "bot_missing"]);
    expect(asked.filter((u) => u.includes("/guilds/"))).toEqual([
      `${ctx.env.DISCORD_API_BASE_URL}/guilds/${ALPHA}`,
    ]);
    expect(await ownedRows(db, b.workspace)).toEqual(before);
  });
});
