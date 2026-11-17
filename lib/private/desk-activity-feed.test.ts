// Home's recent activity (D108), second part: grouping, saved drafts past their 7 days, Undo, the cap.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { openDrafts } from "../repo/import";
import { memberFacts, memberFollowUps, pendingMembers } from "../schema";
import { thanksShares, thanksTakedowns } from "../schema-board";
import { screenshotDrafts } from "../schema-import";
import {
  noticeEdits,
  noticePublishes,
  noticeReviewOutcomes,
  noticeReviews,
  notices,
} from "../schema-notices";
import type { WorkspaceAccess } from "./access";
import { ACTIVITY_MAX, recentActivity } from "./desk-activity";
import { ago, browser, freshWorkspace, linesOf, NOW } from "./desk-activity.test-helpers";

let db: Db;
let ws: number;
beforeAll(async () => {
  db = await openTestDb();
});

beforeEach(async () => {
  ws = await freshWorkspace(db);
});

describe("recent activity", () => {
  it("groups one officer's run of member saves, thefts and new members; a post breaks the run", async () => {
    const a = (await browser(db, ws, "Ana")).userId;
    const fact = (uid: number, at: Date) => ({
      workspaceId: ws,
      uid,
      field: "troops",
      version: 1,
      value: "secret-value",
      source: "officer" as const,
      writtenBy: a,
      writtenAt: at,
    });
    // Older run: Bramble, a sheet batch of three, Thistle; then a Discord post; then Bramble again.
    await db
      .insert(memberFacts)
      .values([
        fact(101, ago(60)),
        { ...fact(201, ago(55)), source: "sheet" as const },
        { ...fact(202, ago(55)), source: "sheet" as const },
        { ...fact(203, ago(55)), source: "sheet" as const },
        { ...fact(102, ago(50)), field: "adTech" },
        { ...fact(101, ago(10)), version: 2 },
      ]);
    const [notice] = await db
      .insert(notices)
      .values({ workspaceId: ws, createdAt: ago(90), updatedAt: ago(90) })
      .returning();
    await db.insert(noticeEdits).values({
      noticeId: notice?.id ?? 0,
      workspaceId: ws,
      field: "title",
      value: "Weekly schedule",
      editedAt: ago(90),
    });
    await db.insert(noticePublishes).values({
      workspaceId: ws,
      noticeId: notice?.id ?? 0,
      requestId: "r1",
      audience: "members",
      languages: "en",
      status: "posted",
      publishedBy: a,
      publishedAt: ago(30),
    });
    const added = (name: string, at: Date) => ({
      workspaceId: ws,
      name,
      nameKey: name.toLowerCase(),
      createdBy: a,
      createdAt: at,
    });
    await db.insert(pendingMembers).values([added("Wobbleton", ago(5)), added("Quince", ago(4))]);

    const me = (await browser(db, ws, "Rook")).visit(NOW);
    expect(linesOf(await recentActivity(db, (await me) as WorkspaceAccess, NOW))).toEqual([
      "Ana added 2 new members",
      "Ana updated Bramble’s info",
      "Ana posted the notice “Weekly schedule” on Discord",
      "Ana updated 5 members",
    ]);
  });

  it("keeps one line for a save older than seven days, and drops a cancelled follow-up", async () => {
    const a = (await browser(db, ws, "Ana")).userId;
    const tenDays = ago(10 * 24 * 60);
    // A member update saved ten days ago, which wrote a fact and a new member at the same instant.
    await db.insert(screenshotDrafts).values({
      workspaceId: ws,
      kind: "member_update",
      scopeSure: true,
      pictureDay: "2026-11-10",
      pages: [["Bramble 9.9M"]],
      rows: [],
      source: "desk",
      status: "saved",
      doneBy: a,
      doneAt: tenDays,
      createdAt: tenDays,
      expiresAt: ago(3 * 24 * 60),
    });
    await db.insert(memberFacts).values({
      workspaceId: ws,
      uid: 101,
      field: "squadMight",
      version: 1,
      value: 9900000,
      source: "message",
      writtenBy: a,
      writtenAt: tenDays,
    });
    await db.insert(pendingMembers).values({
      workspaceId: ws,
      name: "Wobbleton",
      nameKey: "wobbleton",
      createdBy: a,
      createdAt: tenDays,
    });
    // "Talked to them", then Undo: neither shows.
    const follow = (action: "talked" | "withdrawn", at: Date) => ({
      workspaceId: ws,
      uid: 102,
      action,
      writtenBy: a,
      writtenAt: at,
      requestId: randomUUID(),
    });
    await db.insert(memberFollowUps).values(follow("talked", ago(20)));
    await db.insert(memberFollowUps).values(follow("withdrawn", ago(19)));

    await openDrafts(db, ws, NOW); // The list read that drops expired drafts.
    const [kept] = await db.select().from(screenshotDrafts);
    expect(kept?.pages).toEqual([]);
    const me = (await browser(db, ws, "Rook")).visit(NOW);
    expect(linesOf(await recentActivity(db, (await me) as WorkspaceAccess, NOW))).toEqual([
      "Ana saved a screenshot: Member update",
    ]);
  });

  it("words a saved paste as pasted updates, not a screenshot", async () => {
    const a = (await browser(db, ws, "Ana")).userId;
    await db.insert(screenshotDrafts).values({
      workspaceId: ws,
      kind: "member_update",
      scopeSure: true,
      pictureDay: "2026-11-20",
      pages: [],
      rows: [],
      source: "pasted",
      status: "saved",
      doneBy: a,
      doneAt: ago(5),
      createdAt: ago(6),
      expiresAt: ago(-7 * 24 * 60),
    });
    const me = (await browser(db, ws, "Rook")).visit(NOW);
    const items = await recentActivity(db, (await me) as WorkspaceAccess, NOW);
    expect(linesOf(items)).toEqual(["Ana pasted member updates"]);
    expect(linesOf(items, "pt-BR")).toEqual(["Ana colou atualizações de membros"]);
  });

  it("says who asked whom for a review, and who approved or edited after one (D113)", async () => {
    const a = (await browser(db, ws, "Ana")).userId;
    const viewer = await browser(db, ws, "Rook");
    const r = viewer.userId;
    const [notice] = await db
      .insert(notices)
      .values({ workspaceId: ws, createdAt: ago(90), updatedAt: ago(90) })
      .returning();
    const noticeId = notice?.id ?? 0;
    const edit = (by: number | null, at: Date) => ({
      noticeId,
      workspaceId: ws,
      field: "title",
      value: "Garden rota",
      editedBy: by,
      editedAt: at,
    });
    await db.insert(noticeEdits).values(edit(null, ago(90)));
    const ask = (
      requestId: string,
      language: string | null,
      reviewerId: number | null,
      at: Date,
    ) => ({
      workspaceId: ws,
      noticeId,
      requestId,
      language,
      reviewerId,
      askedBy: a,
      askedAt: at,
    });
    const [toRook, toTeam] = await db
      .insert(noticeReviews)
      .values([ask("q1", "pt-BR", r, ago(40)), ask("q2", null, null, ago(30))])
      .returning();
    // Rook approves PT, then edits from the team's request: the save and the outcome share one instant.
    await db.insert(noticeReviewOutcomes).values([
      {
        workspaceId: ws,
        reviewId: toRook?.id ?? 0,
        requestId: "o1",
        outcome: "approved",
        by: r,
        at: ago(20),
      },
      {
        workspaceId: ws,
        reviewId: toTeam?.id ?? 0,
        requestId: "o2",
        outcome: "edited",
        by: r,
        at: ago(10),
      },
    ]);
    await db.insert(noticeEdits).values(edit(r, ago(10)));
    const items = await recentActivity(db, (await viewer.visit(NOW)) as WorkspaceAccess, NOW);
    expect(linesOf(items)).toEqual([
      "Rook edited the notice “Garden rota” after a review",
      "Rook approved the notice “Garden rota” · PT",
      "Ana asked the team to review the notice “Garden rota” · All languages",
      "Ana asked Rook to review the notice “Garden rota” · PT",
    ]);
    expect(linesOf(items, "pt-BR")[3]).toBe(
      "Ana pediu a Rook que revise o aviso “Garden rota” · PT",
    );
  });

  it("says where the thanks were shared, and who took them down; a failed post is not a line", async () => {
    const a = (await browser(db, ws, "Ana")).userId;
    const share = (target: string, status: string, at: Date) => ({
      workspaceId: ws,
      requestId: randomUUID(),
      target,
      week: "2026-11-16",
      texts: { en: "Thank you, Bramble." },
      names: ["Bramble"],
      status,
      sharedBy: a,
      sharedAt: at,
    });
    const [, board] = await db
      .insert(thanksShares)
      .values([
        share("discord", "posted", ago(30)),
        share("board", "posted", ago(20)),
        share("discord", "failed", ago(15)),
      ])
      .returning({ id: thanksShares.id });
    await db
      .insert(thanksTakedowns)
      .values({ shareId: board?.id ?? 0, takenBy: a, takenAt: ago(5) });
    const me = (await browser(db, ws, "Rook")).visit(NOW);
    const items = await recentActivity(db, (await me) as WorkspaceAccess, NOW);
    expect(linesOf(items)).toEqual([
      "Ana took the thanks down from the members’ board",
      "Ana shared the thanks on the members’ board",
      "Ana shared the thanks on Discord",
    ]);
    expect(linesOf(items, "pt-BR")[2]).toBe("Ana compartilhou os agradecimentos no Discord");
  });

  it("holds at most ACTIVITY_MAX lines", async () => {
    const a = (await browser(db, ws, "Ana")).userId;
    await db.insert(memberFollowUps).values(
      Array.from({ length: ACTIVITY_MAX + 5 }, (_, i) => ({
        workspaceId: ws,
        uid: 1000 + i,
        action: "talked" as const,
        writtenBy: a,
        writtenAt: ago(i + 1),
        requestId: randomUUID(),
      })),
    );
    const me = (await browser(db, ws, "Rook")).visit(NOW);
    const items = await recentActivity(db, (await me) as WorkspaceAccess, NOW);
    expect(items).toHaveLength(ACTIVITY_MAX);
    expect(linesOf(items)[0]).toBe("Ana talked to a member");
  });
});
