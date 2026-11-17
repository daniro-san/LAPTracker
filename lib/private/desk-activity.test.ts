import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import {
  dailyReads,
  dailyRosters,
  memberFacts,
  memberFollowUps,
  rollCallMarks,
  rollCalls,
  workspaceSessions,
} from "../schema";
import { screenshotDrafts } from "../schema-import";
import { noticeEdits, notices } from "../schema-notices";
import { thefts } from "../schema-thefts";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { onDeskNow, recentActivity } from "./desk-activity";
import { activityLine } from "./desk-activity-words";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { createSession } from "./session";

const OGS = 67111155;
const NOW = new Date("2026-11-20T12:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
const t = WORKSPACE_DICTIONARIES.en;

let db: Db;
let ws: number;
beforeAll(async () => {
  db = await openTestDb();
});

beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  ws = (await findWorkspaceBySlug(db, "ogs"))?.id ?? 0;
  await db
    .insert(dailyReads)
    .values({ day: "2026-11-19", startedAt: ago(600), status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-19",
    unionId: OGS,
    memberCount: 2,
    sourceUpdatedAt: ago(600),
    isFresh: true,
    memberUids: [101, 102],
    memberNames: ["Bramble", "Thistle"],
    memberPower: [1000, 1000],
    memberKills: [0, 0],
    rawJson: { members: [] },
  });
});

/** A signed-in browser of `name`: its cookie, and a request made with it at `at`. */
async function browser(name: string, tier: "officer" | "member" = "officer") {
  const userId = await recordSignIn(db, ws, `ogs-${name}`, name, ago(120));
  const { token } = await createSession(db, ws, userId, ago(120), null, tier);
  const visit = async (at: Date): Promise<WorkspaceAccess | null> => {
    const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, at);
    return access.ok ? access : null;
  };
  return { userId, visit };
}

const seenAt = async () => (await db.select().from(workspaceSessions)).map((s) => s.seenAt);

describe("on the desk now", () => {
  it("lists the other officers seen in ten minutes, never a member's session", async () => {
    const ana = await browser("Ana");
    const wren = await browser("Wren");
    const rook = await browser("Rook");
    const rio = await browser("Rio", "member");
    await wren.visit(ago(3));
    await rook.visit(ago(11));
    expect(await rio.visit(ago(1))).toBeNull();
    const me = await ana.visit(NOW);
    expect(await onDeskNow(db, me as WorkspaceAccess, NOW)).toEqual(["Wren"]);
  });

  it("writes the last-seen time at most once a minute", async () => {
    const ana = await browser("Ana");
    await ana.visit(ago(2));
    await ana.visit(new Date(ago(2).getTime() + 30_000));
    expect(await seenAt()).toEqual([ago(2)]);
    await ana.visit(ago(0.5));
    expect(await seenAt()).toEqual([ago(0.5)]);
  });
});

describe("recent activity", () => {
  it("one line per action, newest first, with names and never a value or a note", async () => {
    const ana = await browser("Ana");
    const wren = await browser("Wren");
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
    const lines = (await recentActivity(db, me, NOW)).map((i) => activityLine(i, t));
    const plain = lines.map((l) => l.replace(/[⁨⁩]/g, ""));
    expect(plain).toEqual([
      "Wren added a theft to the log",
      "Ana saved a screenshot: Secret Ops report",
      "Wren added a follow-up note for Thistle",
      "Ana marked the rest of the roll call “KvK shield”",
      "Ana marked the roll call “KvK shield”",
      "Wren updated Bramble’s info",
      "Ana saved the notice “Weekly schedule”",
    ]);
    expect(lines.join(" ")).not.toMatch(/secret-value|private-note|theft-note|help|Raider/);
  });
});
