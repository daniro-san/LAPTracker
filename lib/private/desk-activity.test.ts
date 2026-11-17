import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import {
  calendarEntries,
  calendarOccurrences,
  memberFacts,
  memberFollowUps,
  rollCallMarks,
  rollCalls,
  workspaceSessions,
} from "../schema";
import { screenshotDrafts } from "../schema-import";
import { noticeEdits, notices } from "../schema-notices";
import { thefts } from "../schema-thefts";
import type { WorkspaceAccess } from "./access";
import { onDeskNow, recentActivity } from "./desk-activity";
import { ago, browser, freshWorkspace, linesOf, NOW } from "./desk-activity.test-helpers";

let db: Db;
let ws: number;
beforeAll(async () => {
  db = await openTestDb();
});

beforeEach(async () => {
  ws = await freshWorkspace(db);
});

const seenAt = async () => (await db.select().from(workspaceSessions)).map((s) => s.seenAt);

describe("on the desk now", () => {
  it("lists the other officers seen in ten minutes, never a member's session", async () => {
    const ana = await browser(db, ws, "Ana");
    const wren = await browser(db, ws, "Wren");
    const rook = await browser(db, ws, "Rook");
    const rio = await browser(db, ws, "Rio", "member");
    await wren.visit(ago(3));
    await rook.visit(ago(11));
    // A member's session seen a minute ago (set directly): the tier filter keeps it off the list.
    await db
      .update(workspaceSessions)
      .set({ seenAt: ago(1) })
      .where(eq(workspaceSessions.workspaceUserId, rio.userId));
    const me = await ana.visit(NOW);
    expect(await onDeskNow(db, me as WorkspaceAccess, NOW)).toEqual(["Wren"]);
  });

  it("never marks a member's session seen on the members' board", async () => {
    const rio = await browser(db, ws, "Rio", "member");
    expect(await rio.board(ago(1))).toBe(true);
    expect(await seenAt()).toEqual([null]);
  });

  it("writes the last-seen time at most once a minute", async () => {
    const ana = await browser(db, ws, "Ana");
    await ana.visit(ago(2));
    await ana.visit(new Date(ago(2).getTime() + 30_000));
    expect(await seenAt()).toEqual([ago(2)]);
    await ana.visit(ago(0.5));
    expect(await seenAt()).toEqual([ago(0.5)]);
  });
});

describe("recent activity", () => {
  it("one line per action, newest first, with names and never a value or a note", async () => {
    const ana = await browser(db, ws, "Ana");
    const wren = await browser(db, ws, "Wren");
    const a = ana.userId;
    const w = wren.userId;
    // A notice saved with two fields at once.
    const [notice] = await db
      .insert(notices)
      .values({
        workspaceId: ws,
        createdBy: a,
        createdAt: ago(50),
        updatedBy: a,
        updatedAt: ago(50),
      })
      .returning();
    const edit = { noticeId: notice?.id ?? 0, workspaceId: ws, editedBy: a, editedAt: ago(50) };
    await db.insert(noticeEdits).values([
      { ...edit, field: "title", value: "Weekly schedule" },
      { ...edit, field: "en", value: "Body" },
    ]);
    // A member's facts, saved twice in a row: one line.
    const fact = { workspaceId: ws, uid: 101, field: "troops", source: "officer" as const };
    await db.insert(memberFacts).values([
      { ...fact, version: 1, value: "secret-value-1", writtenBy: w, writtenAt: ago(45) },
      { ...fact, version: 2, value: "secret-value-2", writtenBy: w, writtenAt: ago(40) },
    ]);
    // Roll call: three single taps within the hour, then "the rest" on three members.
    const [call] = await db
      .insert(rollCalls)
      .values({ workspaceId: ws, kind: "shield", day: "2026-11-20", week: "2026-11-16" })
      .returning();
    const mark = (uid: number, at: Date) => ({
      rollCallId: call?.id ?? 0,
      uid,
      version: 1,
      mark: "yes",
      writtenBy: a,
      writtenAt: at,
    });
    await db.insert(rollCallMarks).values([mark(1, ago(35)), mark(2, ago(34)), mark(3, ago(33))]);
    await db.insert(rollCallMarks).values([mark(4, ago(30)), mark(5, ago(30)), mark(6, ago(30))]);
    // A follow-up that also wrote a fact at the same instant: the follow-up stands for both.
    await db.insert(memberFollowUps).values({
      workspaceId: ws,
      uid: 102,
      action: "help",
      note: "private-note",
      writtenBy: w,
      writtenAt: ago(20),
      requestId: randomUUID(),
    });
    await db.insert(memberFacts).values({
      ...fact,
      uid: 102,
      field: "status",
      version: 1,
      value: "help",
      writtenBy: w,
      writtenAt: ago(20),
    });
    // A Secret Ops screenshot saved, which wrote two thefts at the same instant.
    await db.insert(screenshotDrafts).values({
      workspaceId: ws,
      kind: "secret_ops",
      scopeSure: true,
      pictureDay: "2026-11-20",
      pages: [],
      rows: [],
      source: "desk",
      status: "saved",
      doneBy: a,
      doneAt: ago(10),
      createdAt: ago(15),
      expiresAt: ago(-10_000),
    });
    const theft = {
      workspaceId: ws,
      attackerKey: "name:raider",
      attackerName: "Raider",
      attackerTag: "XYZ",
      source: "photo" as const,
      note: "theft-note",
      victimName: "Bramble",
    };
    await db.insert(thefts).values([
      { ...theft, createdBy: a, createdAt: ago(10) },
      { ...theft, createdBy: a, createdAt: ago(10) },
      { ...theft, source: "typed" as const, createdBy: w, createdAt: ago(5) },
    ]);

    const me = (await ana.visit(NOW)) as WorkspaceAccess;
    const plain = linesOf(await recentActivity(db, me, NOW));
    expect(plain).toEqual([
      "Wren added a theft to the log",
      "Ana saved a screenshot: Secret Ops report",
      "Wren marked Thistle as needing help",
      "Ana finished the roll call “KvK shield”",
      "Ana took the roll call “KvK shield”",
      "Wren updated Bramble’s info",
      "Ana saved the notice “Weekly schedule”",
    ]);
    expect(plain.join(" ")).not.toMatch(/secret-value|private-note|theft-note|Raider/);
  });

  it("names a calendar change and the follow-up choice, never the note", async () => {
    const a = (await browser(db, ws, "Ana")).userId;
    const w = (await browser(db, ws, "Wren")).userId;
    const stamp = (by: number, at: Date) => ({ v: 1, by, at: at.toISOString() });
    const [entry] = await db
      .insert(calendarEntries)
      .values({
        workspaceId: ws,
        kind: "undead",
        level: 5,
        day: "2026-11-21",
        minute: 1200,
        createdBy: a,
        createdAt: ago(60),
        rev: 1,
        // Two fields changed in one save: one line.
        edits: { level: stamp(a, ago(30)), notes: stamp(a, ago(30)) },
      })
      .returning();
    await db.insert(calendarOccurrences).values({
      workspaceId: ws,
      entryId: entry?.id ?? 0,
      week: "2026-11-16",
      day: "2026-11-22",
      minute: 1200,
      rev: 1,
      edits: { when: stamp(w, ago(20)) },
    });
    const follow = (uid: number, action: "talked" | "break" | "fine", at: Date) => ({
      workspaceId: ws,
      uid,
      action,
      note: "private-note",
      until: action === "break" ? "2026-11-24" : null,
      writtenBy: w,
      writtenAt: at,
      requestId: randomUUID(),
    });
    await db
      .insert(memberFollowUps)
      .values([
        follow(101, "talked", ago(15)),
        follow(102, "break", ago(10)),
        follow(99, "fine", ago(5)),
      ]);

    const me = (await browser(db, ws, "Rook")).visit(NOW);
    const items = await recentActivity(db, (await me) as WorkspaceAccess, NOW);
    const plain = (language: "en" | "fr") => linesOf(items, language);
    expect(plain("en")).toEqual([
      "Wren noted a member is fine",
      "Wren marked Thistle on a break until Nov\u00a024",
      "Wren talked to Bramble",
      "Wren changed the Calendar entry “Undead Siege · Lv.5”",
      "Ana changed the Calendar entry “Undead Siege · Lv.5”",
      "Ana added “Undead Siege · Lv.5” to the Calendar",
    ]);
    expect(plain("fr")[1]).toBe("Wren a mis Thistle en pause jusqu’au 24\u00a0nov.");
    expect(plain("en").join(" ")).not.toMatch(/private-note/);
  });
});
