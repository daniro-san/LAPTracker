// Test-only (D125): the parts of lib/workspace-data.test-helpers.ts's seed, split for size: notices, roll
// calls and thefts, imports, and the key and data requests. Invented names and values only.
import type { Db } from "./db";
import { memberFollowUps, rollCallMarks, rollCalls, rollCallTeam } from "./schema";
import { workspaceDiscord, workspacePostTouches, workspaceWebhooks } from "./schema-discord";
import { workspaceFeatures, workspaceUsage } from "./schema-features";
import { feedback } from "./schema-feedback";
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
import { pushMarks, pushSubscriptions } from "./schema-push";
import { workspaceDataEvents } from "./schema-retention";
import { shieldChecks, shieldQueue, shieldSettings } from "./schema-shield";
import { memberSquads, playerHistory, playerReads, squadQueue, squadReads } from "./schema-squads";
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
  // D132: the queue, and a player read whose raw body holds the private markers (scrubbed on download).
  await db
    .insert(squadQueue)
    .values({ day: DAY, unionId, uid: 101, state: "done", attempts: 1, dueAt: SEED_AT });
  await db.insert(playerReads).values({
    unionId,
    uid: 101,
    readAt: SEED_AT,
    rawJson: {
      uid: 101,
      x: 98765,
      y: 54321,
      online: true,
      last_online_at: 1763337600,
      avatar_url: "https://avatar.example.test/a.png",
      history: [{ observed_at: 1763300000, x: 98765, y: 54321 }],
    },
    shielding: 1,
    language: "en",
  });
  await db.insert(playerHistory).values({
    unionId,
    uid: 101,
    t: SEED_AT,
    power: 10,
    unionAbbr: "INV",
  });
  // D137: the Raid Shield check's settings, its reads' state and the morning queue.
  await db.insert(shieldSettings).values({ workspaceId: ws, discord: true, updatedAt: SEED_AT });
  await db.insert(shieldChecks).values({ day: DAY, unionId, nightAt: SEED_AT, messageId: "1" });
  await db
    .insert(shieldQueue)
    .values({ day: DAY, unionId, uid: 101, state: "done", attempts: 1, dueAt: SEED_AT });
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
  await db.insert(workspaceFeatures).values({ workspaceId: ws, switches: { thefts: false } });
  await db.insert(workspaceUsage).values({ workspaceId: ws, allowance: "ai", day: DAY, used: 3 });
  // D129: a sealed webhook (never downloaded, like the key) and the bot seen with its commands.
  await db.insert(workspaceWebhooks).values({
    workspaceId: ws,
    channel: "members",
    ciphertext: KEY_MARKER,
    nonce: "NONCE-MARKER",
    masterFp: "fp-marker",
    name: "town-square",
    forum: false,
    savedBy: officer,
    savedAt: SEED_AT,
    requestId: `hook-${ws}`,
  });
  await db
    .insert(workspaceDiscord)
    .values({ workspaceId: ws, botSeenAt: SEED_AT, commands: [], commandsAt: SEED_AT });
  await seedPush(db, ws, officer);
}

/** D156: the alliance's own line on its weekly thanks. */
async function seedCallout(db: Db, ws: number, officer: number) {
  await db.insert(workspacePostTouches).values({
    workspaceId: ws,
    postKey: "thanks",
    callout: "Thank you, family",
    updatedBy: officer,
    updatedAt: SEED_AT,
  });
}

/** D148: an officer's sealed device (never downloaded, like the webhook) and a trigger's mark. */
async function seedPush(db: Db, ws: number, officer: number) {
  await seedCallout(db, ws, officer);
  await db.insert(pushSubscriptions).values({
    workspaceId: ws,
    workspaceUserId: officer,
    endpointHash: `hash-${ws}`,
    ciphertext: KEY_MARKER,
    nonce: "NONCE-MARKER",
    masterFp: "fp-marker",
    uses: ["shield"],
    language: "en",
    createdAt: SEED_AT,
  });
  await db
    .insert(pushMarks)
    .values({ workspaceId: ws, key: `night:${DAY}`, value: "failed", sentAt: SEED_AT });
  // D155: feedback sent from the workspace's desk to the site's owner (deleted with it, never downloaded).
  await db.insert(feedback).values({
    area: "desk",
    kind: "idea",
    text: "A calendar view by month",
    path: `/w/ws-${ws}`,
    language: "en",
    workspaceId: ws,
    tier: "officer",
    createdAt: SEED_AT,
  });
}
