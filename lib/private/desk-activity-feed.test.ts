// Home's recent activity (D108), second part: grouping, saved drafts past their 7 days, Undo, the cap.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { openDrafts } from "../repo/import";
import { memberFacts, memberFollowUps, pendingMembers } from "../schema";
import { screenshotDrafts } from "../schema-import";
import { noticeEdits, noticePublishes, notices } from "../schema-notices";
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
