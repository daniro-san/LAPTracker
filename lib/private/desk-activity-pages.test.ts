// Home's recent activity (D108, 2026-11-18, issue 410): runs of one kind that open to their lines, and pages
// read with a cursor; a roll call finished by several officers as one line (issue 585). Invented names.
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { memberFollowUps, rollCallMarks, rollCalls, workspaceUsers } from "../schema";
import { calendarEntries } from "../schema-calendar";
import { noticeEdits, noticePublishes, notices } from "../schema-notices";
import { thefts } from "../schema-thefts";
import type { WorkspaceAccess } from "./access";
import { ACTIVITY_PAGE, activityPage, type ActivityLine, type ActivityPage } from "./desk-activity";
import {
  ago,
  browser,
  freshWorkspace,
  linesOf,
  NOW,
  recentActivity,
} from "./desk-activity.test-helpers";

let db: Db;
let ws: number;
beforeAll(async () => {
  db = await openTestDb();
});

beforeEach(async () => {
  ws = await freshWorkspace(db);
});

/** A roll call of `kind` on server day `day` of this week; its id. */
const rollCall = async (kind: string, day: string) =>
  (
    await db
      .insert(rollCalls)
      .values({ workspaceId: ws, kind, day, week: "2026-11-16" })
      .returning()
  )[0]?.id ?? 0;
/** "Finished" is one officer writing two marks at one instant ("the rest"). */
let markUid = 0;
const finished = (rollCallId: number, by: number | undefined, at: Date) =>
  [0, 1].map(() => ({
    rollCallId,
    uid: ++markUid,
    version: 1,
    mark: "yes",
    writtenBy: by,
    writtenAt: at,
  }));
const officers = (names: string[]) =>
  Promise.all(names.map(async (name) => (await browser(db, ws, name)).userId));

describe("recent activity pages", () => {
  it("folds one officer's calendar adds on one server day into a line that holds them", async () => {
    const r = (await browser(db, ws, "Rook")).userId;
    const a = (await browser(db, ws, "Ana")).userId;
    const entry = (by: number, title: string, at: Date) => ({
      workspaceId: ws,
      kind: "other",
      title,
      day: "2026-11-22",
      minute: 1200,
      createdBy: by,
      createdAt: at,
    });
    // Six in a row; Ana's add ends the run; then Rook again, and two of Rook's from the day before (UTC).
    await db
      .insert(calendarEntries)
      .values([
        ...[10, 11, 12, 13, 14, 15].map((m) => entry(r, `Drill ${m}`, ago(m))),
        entry(a, "Market day", ago(20)),
        entry(r, "Garden walk", ago(25)),
        entry(r, "Night watch", ago(13 * 60)),
        entry(r, "Dawn watch", ago(13 * 60 + 5)),
      ]);
    const me = (await browser(db, ws, "Wren")).visit(NOW);
    const lines = await recentActivity(db, (await me) as WorkspaceAccess, NOW);
    expect(linesOf(lines)).toEqual([
      "Rook added 6 entries to the Calendar",
      "Ana added “Market day” to the Calendar",
      "Rook added “Garden walk” to the Calendar",
      "Rook added 2 entries to the Calendar",
    ]);
    expect(lines[0]?.run.map((l) => l.at)).toEqual([10, 11, 12, 13, 14, 15].map(ago));
    expect(lines[1]?.run).toEqual([]);
    expect(linesOf(lines, "pt-BR")[0]).toBe("Rook adicionou 6 itens à Agenda");
  });

  it("pages with the cursor: every action once, none missed, an instant never split", async () => {
    const a = (await browser(db, ws, "Ana")).userId;
    // 45 follow-ups (more than one source read holds); two share the instant at a page's edge.
    const times = Array.from({ length: 45 }, (_, i) => ago(i === 20 ? 20 : i + 1));
    await db.insert(memberFollowUps).values(
      times.map((at, i) => ({
        workspaceId: ws,
        uid: 1000 + i,
        action: "talked" as const,
        writtenBy: a,
        writtenAt: at,
        requestId: randomUUID(),
      })),
    );
    const { lines, pages } = await everyPage("Rook");
    expect(pages).toBeGreaterThan(2);
    expect(lines.map((l) => l.item.at)).toEqual(times);
  });

  it("pages two sources together when only one fills its read", async () => {
    const a = (await browser(db, ws, "Ana")).userId;
    const w = (await browser(db, ws, "Wren")).userId;
    // Ana's 45 follow-ups on odd minutes; Wren's 10 thefts on every fourth even minute, each between two of Ana's.
    const talks = Array.from({ length: 45 }, (_, i) => ago(2 * i + 1));
    const stolen = Array.from({ length: 10 }, (_, k) => ago(4 * k + 2));
    await db.insert(memberFollowUps).values(
      talks.map((at, i) => ({
        workspaceId: ws,
        uid: 1000 + i,
        action: "talked" as const,
        writtenBy: a,
        writtenAt: at,
        requestId: randomUUID(),
      })),
    );
    await db.insert(thefts).values(
      stolen.map((at) => ({
        workspaceId: ws,
        attackerKey: "name:raider",
        attackerName: "Raider",
        attackerTag: "XYZ",
        source: "typed" as const,
        createdBy: w,
        createdAt: at,
      })),
    );
    const { lines } = await everyPage("Rook");
    const all = [...talks, ...stolen].sort((x, y) => y.getTime() - x.getTime());
    expect(lines.map((l) => l.item.at)).toEqual(all);
    expect(linesOf(lines).filter((l) => l === "Wren added a theft to the log")).toHaveLength(10);
  });

  it("never folds two posts in a row into one line", async () => {
    const a = (await browser(db, ws, "Ana")).userId;
    for (const [title, at] of [
      ["Garden rota", ago(10)],
      ["Market day", ago(11)],
    ] as const) {
      const [notice] = await db
        .insert(notices)
        .values({ workspaceId: ws, createdAt: ago(90), updatedAt: ago(90) })
        .returning();
      const noticeId = notice?.id ?? 0;
      await db
        .insert(noticeEdits)
        .values({ noticeId, workspaceId: ws, field: "title", value: title, editedAt: ago(90) });
      await db.insert(noticePublishes).values({
        workspaceId: ws,
        noticeId,
        requestId: randomUUID(),
        audience: "members",
        languages: "en",
        status: "posted",
        publishedBy: a,
        publishedAt: at,
      });
    }
    const me = (await browser(db, ws, "Rook")).visit(NOW);
    expect(linesOf(await recentActivity(db, (await me) as WorkspaceAccess, NOW))).toEqual([
      "Ana posted the notice “Garden rota” on Discord",
      "Ana posted the notice “Market day” on Discord",
    ]);
  });

  it("folds a roll call finished by several officers into one line naming each once (issue 585)", async () => {
    const [wren, tomas, lucien, kira, annelie, rook] = await officers([
      "Wren",
      "Tomas",
      "Lucien",
      "Kira",
      "Annelie",
      "Rook",
    ]);
    const [cheese, siege, cheese2] = [
      await rollCall("cheese", "2026-11-20"),
      await rollCall("raid", "2026-11-20"),
      await rollCall("cheese", "2026-11-19"),
    ];
    await db.insert(rollCallMarks).values([
      ...[wren, tomas, lucien, kira, annelie].flatMap((by, i) => finished(cheese, by, ago(10 + i))),
      ...finished(cheese, wren, ago(75)), // Wren again, an hour earlier: named once
      ...[tomas, kira, rook].flatMap((by, i) => finished(siege, by, ago(90 + i))),
      ...finished(cheese, lucien, ago(100)), // after a line in between: a line of its own
      ...finished(cheese2, annelie, ago(101)), // another "Cheese Trap" roll call
      ...finished(cheese2, lucien, ago(102)),
      ...finished(cheese, lucien, ago(190)), // the same words on the other roll call: a line of its own
      ...finished(cheese2, kira, ago(13 * 60)), // the day before (UTC)
      ...finished(cheese, kira, ago(13 * 60 + 1)), // the same words in a row: one line, as before
    ]);
    const me = (await (await browser(db, ws, "Ana")).visit(NOW)) as WorkspaceAccess;
    const lines = await recentActivity(db, me, NOW);
    expect(linesOf(lines)).toEqual([
      "Wren, Tomas, and 3 others finished the roll call “Cheese Trap”",
      "Tomas, Kira, and Rook finished the roll call “Undead Siege”",
      "Lucien finished the roll call “Cheese Trap”",
      "Annelie and Lucien finished the roll call “Cheese Trap”",
      "Lucien finished the roll call “Cheese Trap”",
      "Kira finished the roll call “Cheese Trap”",
    ]);
    expect(lines[0]?.run.map((l) => l.who)).toEqual([
      "Wren",
      "Tomas",
      "Lucien",
      "Kira",
      "Annelie",
      "Wren",
    ]);
    expect(linesOf(lines, "fr")[0]).toBe(
      "Wren, Tomas et 3 autres ont terminé l’appel «\u00a0Cheese Trap\u00a0»",
    );
    expect(linesOf(lines, "pt-BR")[3]).toBe("Annelie e Lucien concluíram a chamada “Cheese Trap”");
    // An officer whose account has no name any more is left out; the others' line stays (D108).
    await db
      .update(workspaceUsers)
      .set({ displayName: null })
      .where(eq(workspaceUsers.id, wren ?? 0));
    expect(linesOf(await recentActivity(db, me, NOW))[0]).toBe(
      "Tomas, Lucien, and 2 others finished the roll call “Cheese Trap”",
    );
  });

  it("keeps a roll call two officers finished as one line at a page's end, each action once after Show more (issue 585)", async () => {
    const [ana, wren, tomas, kira] = await officers(["Ana", "Wren", "Tomas", "Kira"]);
    const cheese = await rollCall("cheese", "2026-11-20");
    await db
      .insert(rollCallMarks)
      .values([...finished(cheese, wren, ago(10)), ...finished(cheese, tomas, ago(11))]);
    const theft = (by: number | undefined, at: Date) => ({
      workspaceId: ws,
      attackerKey: "name:raider",
      attackerName: "Raider",
      attackerTag: "XYZ",
      source: "typed" as const,
      createdBy: by,
      createdAt: at,
    });
    await db.insert(thefts).values([theft(ana, ago(5)), theft(kira, ago(20))]);
    // Two lines a page: the fold is the first page's last line, and the next page starts below Tomas.
    const { lines, pages } = await everyPage("Rook", 2);
    expect(pages).toBe(2);
    expect(linesOf(lines)).toEqual([
      "Ana added a theft to the log",
      "Wren and Tomas finished the roll call “Cheese Trap”",
      "Kira added a theft to the log",
    ]);
    expect(lines[1]?.run.map((l) => l.who)).toEqual(["Wren", "Tomas"]);
  });

  it("folds a roll call by the server's day, split at its midnight, not UTC's (issue 585)", async () => {
    const [lucien, kira, annelie, rook] = await officers(["Lucien", "Kira", "Annelie", "Rook"]);
    const cheese = await rollCall("cheese", "2026-11-19");
    // Server time UTC−2: Fri 00:30 ST, then Thu 23:30, 22:30 and 21:30 ST (UTC's midnight before the last).
    await db
      .insert(rollCallMarks)
      .values([
        ...finished(cheese, lucien, ago(570)),
        ...finished(cheese, kira, ago(630)),
        ...finished(cheese, annelie, ago(690)),
        ...finished(cheese, rook, ago(750)),
      ]);
    const me = (await (await browser(db, ws, "Ana")).visit(NOW)) as WorkspaceAccess;
    expect(linesOf(await recentActivity(db, me, NOW, 40, "Etc/GMT+2"))).toEqual([
      "Lucien finished the roll call “Cheese Trap”",
      "Kira, Annelie, and Rook finished the roll call “Cheese Trap”",
    ]);
  });

  it("shows a run longer than one read as two lines on two pages, each action once", async () => {
    const r = (await browser(db, ws, "Rook")).userId;
    const times = Array.from({ length: 50 }, (_, i) => ago(i + 1));
    await db.insert(calendarEntries).values(
      times.map((at, i) => ({
        workspaceId: ws,
        kind: "other",
        title: `Drill ${i}`,
        day: "2026-11-22",
        minute: 1200,
        createdBy: r,
        createdAt: at,
      })),
    );
    const { lines, pages } = await everyPage("Wren");
    expect(pages).toBe(2);
    expect(linesOf(lines)).toEqual([
      "Rook added 39 entries to the Calendar",
      "Rook added 11 entries to the Calendar",
    ]);
    expect(lines.flatMap((l) => l.run.map((one) => one.at))).toEqual(times);
  });
});

/** Every page of `size` lines of the feed as `who` sees it, read with the cursor until there is none. */
async function everyPage(who: string, size = ACTIVITY_PAGE) {
  const me = (await (await browser(db, ws, who)).visit(NOW)) as WorkspaceAccess;
  const lines: ActivityLine[] = [];
  let before: Date | null = null;
  let pages = 0;
  do {
    const page: ActivityPage = await activityPage(db, me, { now: NOW, zone: "UTC" }, before, size);
    lines.push(...page.lines);
    before = page.next;
    pages += 1;
  } while (before && pages < 10);
  return { lines, pages };
}
