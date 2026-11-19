// Test-only (D125): the parts of lib/workspace-data.test-helpers.ts's seed, split for size: notices, roll
// calls and thefts, imports, and the key and data requests. Invented names and values only.
import type { Db } from "./db";
import { memberFollowUps, rollCallMarks, rollCalls, rollCallTeam } from "./schema";
import { workspaceFeatures, workspaceUsage } from "./schema-features";
import {
  allianceDuelPoints,
  discordPictures,
  screenshotChecks,
  screenshotDrafts,
} from "./schema-import";
import { workspaceKeyChanges, workspaceKeys } from "./schema-keys";
import {
  noticeEdits,
  noticePictures,
  noticePublishes,
  noticeReviewOutcomes,
  noticeReviews,
  notices,
} from "./schema-notices";
import { workspaceDataEvents } from "./schema-retention";
import { memberSquads, squadReads } from "./schema-squads";
import { theftAttackers, theftFollowUps, thefts } from "./schema-thefts";

export const SEED_AT = new Date("2026-11-18T12:00:00Z");
export const DAY = "2026-11-18";
export const WEEK = "2026-11-16";
export const KEY_MARKER = "SEALED-KEY-CIPHERTEXT-MARKER";
/** A notice picture's bytes: a PNG signature and an invented tail. */
export const PICTURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

export const id = <T extends { id: number }>(rows: T[]) => rows[0]?.id ?? 0;

export async function seedNotices(db: Db, ws: number, officer: number) {
  const notice = id(
    await db
      .insert(notices)
      .values({
        workspaceId: ws,
        createdBy: officer,
        createdAt: SEED_AT,
        updatedBy: officer,
        updatedAt: SEED_AT,
      })
      .returning({ id: notices.id }),
  );
  await db.insert(noticeEdits).values({
    noticeId: notice,
    workspaceId: ws,
    field: "pt-BR",
    value: "Olá, aliança",
    editedBy: officer,
    editedAt: SEED_AT,
  });
  await db.insert(noticePublishes).values({
    workspaceId: ws,
    noticeId: notice,
    requestId: `post-${ws}`,
    audience: "members",
    languages: "en",
    status: "posted",
    publishedAt: SEED_AT,
  });
  const review = id(
    await db
      .insert(noticeReviews)
      .values({ workspaceId: ws, noticeId: notice, requestId: `review-${ws}`, askedAt: SEED_AT })
      .returning({ id: noticeReviews.id }),
  );
  await db.insert(noticeReviewOutcomes).values({
    workspaceId: ws,
    reviewId: review,
    requestId: `outcome-${ws}`,
    outcome: "approved",
    at: SEED_AT,
  });
  await db.insert(noticePictures).values({
    noticeId: notice,
    workspaceId: ws,
    data: PICTURE,
    type: "image/png",
    width: 1,
    height: 1,
    bytes: PICTURE.byteLength,
    hash: "picturehash",
    addedAt: SEED_AT,
  });
}

export async function seedCallsAndThefts(db: Db, ws: number, officer: number) {
  const call = id(
    await db
      .insert(rollCalls)
      .values({ workspaceId: ws, kind: "shield", day: DAY, week: WEEK, requestId: `call-${ws}` })
      .returning({ id: rollCalls.id }),
  );
  await db
    .insert(rollCallMarks)
    .values({ rollCallId: call, uid: 101, version: 1, mark: "yes", writtenAt: SEED_AT });
  await db
    .insert(rollCallTeam)
    .values({ rollCallId: call, uid: 101, name: "Ana Example", addedAt: SEED_AT });
  await db.insert(memberFollowUps).values({
    workspaceId: ws,
    uid: 101,
    action: "talked",
    writtenBy: officer,
    writtenAt: SEED_AT,
    requestId: crypto.randomUUID(),
  });
  const theft = {
    workspaceId: ws,
    attackerKey: "name:raider",
    attackerName: "Raider",
    attackerTag: "XX",
    source: "typed" as const,
    createdAt: SEED_AT,
  };
  await db.insert(thefts).values([theft, { ...theft, deletedAt: SEED_AT, deletedBy: officer }]);
  await db.insert(theftFollowUps).values({
    workspaceId: ws,
    attackerKey: "name:raider",
    state: "warned",
    changedAt: SEED_AT,
  });
  await db
    .insert(theftAttackers)
    .values({ workspaceId: ws, attackerKey: "name:raider", server: 325, setAt: SEED_AT });
}

export async function seedImports(db: Db, ws: number) {
  await db.insert(screenshotDrafts).values({
    workspaceId: ws,
    kind: "duel",
    scopeSure: true,
    pictureDay: DAY,
    pages: [["Ana Example 5"]],
    rows: [],
    source: "desk",
    createdAt: SEED_AT,
    expiresAt: SEED_AT,
  });
  await db.insert(discordPictures).values({
    workspaceId: ws,
    messageId: "m1",
    attachmentId: "a1",
    createdAt: SEED_AT,
  });
  await db.insert(allianceDuelPoints).values({
    workspaceId: ws,
    uid: 101,
    week: WEEK,
    day: "mon",
    points: 5,
    savedAt: SEED_AT,
  });
  await db.insert(screenshotChecks).values({
    workspaceId: ws,
    kind: "might",
    pictureDay: DAY,
    rows: 1,
    compared: 1,
    same: 1,
    differ: 0,
    savedAt: SEED_AT,
  });
}

/** The squads read on the workspace's key, the key itself (sealed: a marker) and the data requests. */
export async function seedKeyAndData(db: Db, ws: number, unionId: number, officer: number) {
  await db
    .insert(memberSquads)
    .values({ unionId, uid: 101, squad: 1, power: 10, heroes: [], readAt: SEED_AT });
  await db
    .insert(squadReads)
    .values({ day: DAY, unionId, status: "done", startedAt: SEED_AT, members: 1 });
  await db.insert(workspaceKeyChanges).values({
    workspaceId: ws,
    action: "set",
    changedBy: officer,
    changedAt: SEED_AT,
    requestId: `key-${ws}`,
  });
  await db.insert(workspaceKeys).values({
    workspaceId: ws,
    ciphertext: KEY_MARKER,
    nonce: "NONCE-MARKER",
    masterFp: "fp-marker",
    last4: "zz99",
    status: "ok",
    statusAt: SEED_AT,
  });
  await db.insert(workspaceDataEvents).values({
    workspaceId: ws,
    action: "delete_cancelled",
    by: officer,
    at: SEED_AT,
    requestId: `data-${ws}`,
  });
  // D126: the owner's switches and the day's count.
  await db.insert(workspaceFeatures).values({ workspaceId: ws, off: ["thefts"] });
  await db.insert(workspaceUsage).values({ workspaceId: ws, allowance: "ai", day: DAY, used: 3 });
}
