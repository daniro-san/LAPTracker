// The weekly cleanup of notice pictures (D119): a picture whose notice ended more than 90 days ago is
// deleted; one that ended exactly 90 days ago, and one whose notice has no end day, stay. The notice and
// its text stay, and a picture can be added again.
import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { pruneEndedPictures } from "../repo/notice-pictures";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { noticePictures } from "../schema-notices";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { savePicture } from "./notice-picture";
import { pngHeader } from "./notice-picture.test-helpers";
import { noticeDetail, saveNotice } from "./notices";
import { createSession } from "./session";

const NOW = new Date("2026-11-18T12:00:00Z");
const TODAY = "2026-11-18";

let db: Db;
let officer: WorkspaceAccess;
beforeAll(async () => {
  db = await openTestDb();
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

/** A notice ending on `endsOn` ("" for none), with a picture. */
async function pictured(endsOn: string): Promise<number> {
  const changes = [
    { field: "title" as const, value: `Rota ${endsOn || "open"}`, version: 0 },
    { field: "en" as const, value: "Water the roses.", version: 0 },
    { field: "ends_on" as const, value: endsOn, version: 0 },
  ];
  const saved = await saveNotice(db, officer, null, changes, NOW, randomUUID());
  if (!saved.ok) throw new Error("notice not saved");
  expect((await savePicture(db, officer, saved.id, pngHeader(40, 30), NOW)).ok).toBe(true);
  return saved.id;
}

describe("the weekly notice picture cleanup (D119)", () => {
  it("deletes pictures of notices ended over 90 days ago, keeps the rest and the text", async () => {
    const old = await pictured("2026-08-19");
    const edge = await pictured("2026-08-20");
    const open = await pictured("");
    expect(await pruneEndedPictures(db, TODAY)).toBe(1);
    const left = await db.select({ id: noticePictures.noticeId }).from(noticePictures);
    expect(left.map((r) => r.id).sort()).toEqual([edge, open].sort());
    const notice = await noticeDetail(db, officer, old);
    expect(notice).toMatchObject({ picture: null, fields: { en: { value: "Water the roses." } } });
    expect((await savePicture(db, officer, old, pngHeader(40, 30), NOW)).ok).toBe(true);
  });
});
