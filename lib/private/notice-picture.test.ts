// The weekly cleanup of notice pictures and its warning (D119, owner 2026-11-18): Home lists a picture from 7
// days before it is due; a kept picture is never cleaned; a due picture is deleted only once its warning is 7
// days old; "Use in another notice" copies the bytes to the other notice with its own clock. Also Home's
// "added a picture" line, which pages with the feed's cursor (D108) without repeating.
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { pruneEndedPictures, shiftDay } from "../repo/notice-picture-cleanup";
import { setDefault, setSwitch } from "../repo/workspace-features";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { workspaces } from "../schema";
import { noticePictures } from "../schema-notices";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { activityPage } from "./desk-activity";
import { savePicture } from "./notice-picture";
import { keepPicture, picturesDue, reusePicture } from "./notice-picture-due";
import { pngHeader } from "./notice-picture.test-helpers";
import { deleteNotice, noticeDetail, saveNotice } from "./notices";
import { createSession } from "./session";

/** Noon UTC is the same day in server time (UTC-2). */
const NOW = new Date("2026-11-18T12:00:00Z");
const TODAY = "2026-11-18";
const UTC = { SERVER_TZ: "UTC" };
const DAY = 24 * 60 * 60_000;
const later = (days: number) => new Date(NOW.getTime() + days * DAY);

let db: Db;
let officer: WorkspaceAccess;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: 67111155,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const userId = await recordSignIn(db, ws?.id ?? 0, "id-rook", "Rook", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error("no access");
  officer = access;
});

/** A notice titled `title`, ending on `endsOn` ("" for none), with a picture of `width` px. */
async function pictured(title: string, endsOn: string, width = 40): Promise<number> {
  const changes = [
    { field: "title" as const, value: title, version: 0 },
    { field: "en" as const, value: "Water the roses.", version: 0 },
    { field: "ends_on" as const, value: endsOn, version: 0 },
  ];
  const saved = await saveNotice(db, officer, null, changes, NOW, randomUUID());
  if (!saved.ok) throw new Error("notice not saved");
  expect((await savePicture(db, officer, saved.id, pngHeader(width, 30), NOW)).ok).toBe(true);
  return saved.id;
}

/** Every line of the feed at `at`, page by page through the cursor, `size` lines a page. */
async function feed(at: Date, size = 40) {
  const items = [];
  let before: Date | null = null;
  for (let page = 0; page < 50; page++) {
    const read = await activityPage(db, officer, { now: at, zone: "UTC" }, before, size);
    items.push(...read.lines.map((l) => l.item));
    if (!read.next) return items;
    before = read.next;
  }
  throw new Error("the feed never ended");
}

const stored = async () =>
  (await db.select({ id: noticePictures.noticeId }).from(noticePictures)).map((r) => r.id).sort();

describe("the weekly notice picture cleanup and its warning (D119)", () => {
  it("lists a picture from 7 days before it is due, the soonest first", async () => {
    // Due when the end day is more than 90 days ago: 2026-08-25 is due on Nov 24, six days ahead.
    await pictured("Garden rota", shiftDay(TODAY, -85));
    await pictured("Due in a week", shiftDay(TODAY, -84));
    await pictured("Due in eight days", shiftDay(TODAY, -83));
    await pictured("No end", "");
    const due = await picturesDue(db, officer, NOW, UTC);
    expect(due.map((d) => d.title)).toEqual(["Garden rota", "Due in a week"]);
    // Not warned yet: the earliest deletion is 7 days from today, so "after" today + 6.
    expect(due.map((d) => d.after)).toEqual([shiftDay(TODAY, 6), shiftDay(TODAY, 6)]);
  });

  it("never cleans a kept picture", async () => {
    const id = await pictured("Old map", shiftDay(TODAY, -200));
    expect(await keepPicture(db, officer, id, true, NOW)).toEqual({ changed: true });
    for (const days of [0, 7, 14, 21]) {
      expect(await pruneEndedPictures(db, shiftDay(TODAY, days), later(days))).toBe(0);
    }
    expect(await stored()).toEqual([id]);
    expect(await picturesDue(db, officer, NOW, UTC)).toEqual([]);
  });

  it("deletes a due picture only once its warning is 7 days old, and keeps the notice text", async () => {
    const id = await pictured("Old map", shiftDay(TODAY, -200));
    const open = await pictured("No end", "");
    expect(await pruneEndedPictures(db, TODAY, NOW)).toBe(0);
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 6), later(6))).toBe(0);
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 7), later(7))).toBe(1);
    expect(await stored()).toEqual([open]);
    const [row] = await db.select().from(noticePictures);
    expect(row?.noticeId).toBe(open);
    expect((await savePicture(db, officer, id, pngHeader(40, 30), later(7))).ok).toBe(true);
  });

  it("copies a picture to another notice, which gets its own clock", async () => {
    const from = await pictured("Old map", shiftDay(TODAY, -200), 41);
    const to = await pictured("New rota", "");
    await pruneEndedPictures(db, TODAY, NOW);
    expect(await reusePicture(db, officer, from, to, later(1))).toEqual({ changed: true });
    const rows = await db.select().from(noticePictures);
    const copy = rows.find((r) => r.noticeId === to);
    const source = rows.find((r) => r.noticeId === from);
    expect(copy).toMatchObject({ copiedFrom: from, width: 41, hash: source?.hash, warnedAt: null });
    expect(Buffer.from(copy?.data ?? []).equals(Buffer.from(source?.data ?? []))).toBe(true);
    expect(await feed(later(1))).toContainEqual(
      expect.objectContaining({ kind: "noticePictureReused", from: "Old map", title: "New rota" }),
    );
  });

  it("says on Home who added a picture to which notice", async () => {
    await pictured("Garden rota", "");
    expect(await feed(later(1))).toContainEqual(
      expect.objectContaining({ kind: "noticePicture", who: "Rook", title: "Garden rota" }),
    );
  });

  it("pages picture lines with the feed's cursor, each once", async () => {
    const titles = ["Rota A", "Rota B", "Rota C", "Rota D", "Rota E"];
    for (const [i, title] of titles.entries()) {
      const changes = [{ field: "title" as const, value: title, version: 0 }];
      const saved = await saveNotice(db, officer, null, changes, NOW, randomUUID());
      if (!saved.ok) throw new Error("notice not saved");
      await savePicture(
        db,
        officer,
        saved.id,
        pngHeader(40 + i, 30),
        new Date(NOW.getTime() + (i + 1) * 60_000),
      );
    }
    const lines = (await feed(later(1), 2)).filter((l) => l.kind === "noticePicture");
    expect(lines.map((l) => ("title" in l ? l.title : "")).sort()).toEqual(titles);
  });

  it("neither warns about nor deletes the picture of a notice in the trash, and a restore brings it back", async () => {
    const id = await pictured("Old map", shiftDay(TODAY, -200));
    await pruneEndedPictures(db, TODAY, NOW);
    await deleteNotice(db, officer, { id, requestId: randomUUID() }, later(1));
    for (const days of [7, 14]) {
      expect(await pruneEndedPictures(db, shiftDay(TODAY, days), later(days))).toBe(0);
    }
    const [warned] = await db.select().from(noticePictures);
    expect(warned?.warnedAt).toBeNull();
    await deleteNotice(db, officer, { id, requestId: randomUUID(), restore: true }, later(15));
    expect(await stored()).toEqual([id]);
    expect((await picturesDue(db, officer, later(15), UTC)).map((d) => d.noticeId)).toEqual([id]);
  });

  it("restarts the 7 days when the end day moves away and back", async () => {
    const endsOn = shiftDay(TODAY, -200);
    const id = await pictured("Old map", endsOn);
    await pruneEndedPictures(db, TODAY, NOW);
    for (const value of ["", endsOn]) {
      const version = (await noticeDetail(db, officer, id))?.fields.ends_on.version ?? 0;
      const saved = await saveNotice(
        db,
        officer,
        id,
        [{ field: "ends_on", value, version }],
        later(6),
      );
      expect(saved.ok).toBe(true);
    }
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 7), later(7))).toBe(0);
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 13), later(13))).toBe(0);
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 14), later(14))).toBe(1);
  });

  it("does not copy the picture of a notice in the trash", async () => {
    const from = await pictured("Old map", "");
    const to = await pictured("New rota", "", 41);
    await deleteNotice(db, officer, { id: from, requestId: randomUUID() }, NOW);
    expect(await reusePicture(db, officer, from, to, later(1))).toBeNull();
    const [row] = await db.select().from(noticePictures).where(eq(noticePictures.noticeId, to));
    expect(row?.width).toBe(41);
  });

  it("deletes nothing while pictures are turned off, and warns 7 days again once they are on (D126)", async () => {
    const id = await pictured("Old map", shiftDay(TODAY, -200));
    await pruneEndedPictures(db, TODAY, NOW);
    await setSwitch(db, officer.workspaceId, "notice_pictures", false, later(1));
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 7), later(7))).toBe(0);
    expect(await stored()).toEqual([id]);
    await setSwitch(db, officer.workspaceId, "notice_pictures", true, later(10));
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 10), later(10))).toBe(0);
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 16), later(16))).toBe(0);
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 17), later(17))).toBe(1);
  });

  it("warns 7 days again when a default turns pictures off and on for an alliance on it (D134)", async () => {
    // A guest alliance: OGs ignores the defaults.
    await db
      .update(workspaces)
      .set({ unionId: 900_001 })
      .where(eq(workspaces.id, officer.workspaceId));
    const id = await pictured("Old map", shiftDay(TODAY, -200));
    await pruneEndedPictures(db, TODAY, NOW);
    // Off and on again between two cleanups: Home could not show the warning meanwhile.
    await setDefault(db, "switches", "notice_pictures", false, later(1));
    await setDefault(db, "switches", "notice_pictures", true, later(2));
    // Without a fresh warning, the one from day 0 would let this run delete the picture at once.
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 10), later(10))).toBe(0);
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 16), later(16))).toBe(0);
    expect(await stored()).toEqual([id]);
    expect(await pruneEndedPictures(db, shiftDay(TODAY, 17), later(17))).toBe(1);
  });
});
