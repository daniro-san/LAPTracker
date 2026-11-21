// push_subscriptions and push_marks (D148): officers' devices for browser notifications, and what each trigger
// last notified. Plain reads and writes; only lib/push.ts opens a sealed subscription, at send time. Every
// read and write names its workspace, and a device's own writes name its officer too.
import { and, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces, workspaceUsers } from "../schema";
import { pushMarks, pushSubscriptions, type PushLanguage, type PushUse } from "../schema-push";
import { workspaceSessions } from "../schema-sessions";

export type NewDevice = Omit<typeof pushSubscriptions.$inferInsert, "id" | "lastSuccessAt">;

/**
 * A device's subscription saved for its officer: a browser re-subscribing, or another officer signing in on
 * the same browser, takes the row over (one endpoint, one officer, per workspace).
 */
export async function saveDevice(db: Db, row: NewDevice): Promise<void> {
  const { workspaceUserId, ciphertext, nonce, masterFp, uses, language, createdAt } = row;
  await db
    .insert(pushSubscriptions)
    .values(row)
    .onConflictDoUpdate({
      target: [pushSubscriptions.workspaceId, pushSubscriptions.endpointHash],
      set: {
        workspaceUserId,
        ciphertext,
        nonce,
        masterFp,
        uses,
        language,
        createdAt,
        lastSuccessAt: null,
      },
    });
}

/** Keeps an officer's `keep` newest devices in a workspace; older ones are deleted. */
export async function trimDevices(db: Db, workspaceId: number, userId: number, keep: number) {
  const mine = and(
    eq(pushSubscriptions.workspaceId, workspaceId),
    eq(pushSubscriptions.workspaceUserId, userId),
  );
  const newest = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(mine)
    .orderBy(desc(pushSubscriptions.createdAt), desc(pushSubscriptions.id))
    .limit(keep);
  if (newest.length < keep) return;
  const ids = newest.map((r) => r.id);
  await db.delete(pushSubscriptions).where(and(mine, notInArray(pushSubscriptions.id, ids)));
}

const device = (workspaceId: number, userId: number, endpointHash: string) =>
  and(
    eq(pushSubscriptions.workspaceId, workspaceId),
    eq(pushSubscriptions.workspaceUserId, userId),
    eq(pushSubscriptions.endpointHash, endpointHash),
  );

/** The uses (when given) and language of an officer's own device; false when it has no row (any more). */
export async function setDevice(
  db: Db,
  key: { workspaceId: number; userId: number; endpointHash: string },
  patch: { uses?: PushUse[]; language: PushLanguage },
): Promise<boolean> {
  const done = await db
    .update(pushSubscriptions)
    .set(patch)
    .where(device(key.workspaceId, key.userId, key.endpointHash))
    .returning({ id: pushSubscriptions.id });
  return done.length > 0;
}

/** "Turn off on this device", or sign-out on it: the officer's own row for that endpoint. */
export async function deleteDevice(
  db: Db,
  key: { workspaceId: number; userId: number; endpointHash: string },
): Promise<void> {
  await db.delete(pushSubscriptions).where(device(key.workspaceId, key.userId, key.endpointHash));
}

/** Every device of a person in a workspace, by their Discord id: they left it or are no officer now. */
export async function deletePersonDevices(db: Db, workspaceId: number, discordUserId: string) {
  const person = db
    .select({ id: workspaceUsers.id })
    .from(workspaceUsers)
    .where(
      and(
        eq(workspaceUsers.workspaceId, workspaceId),
        eq(workspaceUsers.discordUserId, discordUserId),
      ),
    );
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.workspaceId, workspaceId),
        inArray(pushSubscriptions.workspaceUserId, person),
      ),
    );
}

/** The officer's devices in the workspace: which endpoint (its hash) is on for what. */
export async function officerDevices(db: Db, workspaceId: number, userId: number) {
  return db
    .select({ endpointHash: pushSubscriptions.endpointHash, uses: pushSubscriptions.uses })
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.workspaceId, workspaceId),
        eq(pushSubscriptions.workspaceUserId, userId),
      ),
    );
}

/**
 * INVARIANT push.officers-only: a device is notified only while its person is not blocked and holds an
 * officer's session of this workspace that has not ended (at most 7 days after sign-in, D71, D99). A member's
 * session, an ended one or another workspace's never counts.
 */
const officerNow = (workspaceId: number | SQL, now: Date) =>
  sql`exists (select 1 from ${workspaceSessions} where ${workspaceSessions.workspaceUserId} = ${pushSubscriptions.workspaceUserId} and ${workspaceSessions.workspaceId} = ${workspaceId} and ${workspaceSessions.tier} = 'officer' and ${workspaceSessions.expiresAt} > ${now.toISOString()})`;

/** The sealed devices of a workspace's officers that are on for `use`. */
export async function pushRecipients(db: Db, workspaceId: number, use: PushUse, now: Date) {
  return db
    .select({
      id: pushSubscriptions.id,
      ciphertext: pushSubscriptions.ciphertext,
      nonce: pushSubscriptions.nonce,
      masterFp: pushSubscriptions.masterFp,
      language: pushSubscriptions.language,
    })
    .from(pushSubscriptions)
    .innerJoin(workspaceUsers, eq(workspaceUsers.id, pushSubscriptions.workspaceUserId))
    .where(
      and(
        eq(pushSubscriptions.workspaceId, workspaceId),
        eq(workspaceUsers.blocked, false),
        sql`${use} = any(${pushSubscriptions.uses})`,
        officerNow(workspaceId, now),
      ),
    );
}

/**
 * The workspaces with at least one officer's device on for `use` (the tick's roll call reminders), each with
 * one of those officers: the reminder's reads are made on that officer's access (D148).
 */
export async function workspacesWithUse(db: Db, use: PushUse, now: Date) {
  return db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      unionId: workspaces.unionId,
      officer: sql<number>`min(${pushSubscriptions.workspaceUserId})`.mapWith(Number),
    })
    .from(pushSubscriptions)
    .innerJoin(workspaces, eq(workspaces.id, pushSubscriptions.workspaceId))
    .innerJoin(workspaceUsers, eq(workspaceUsers.id, pushSubscriptions.workspaceUserId))
    .where(
      and(
        eq(workspaceUsers.blocked, false),
        sql`${use} = any(${pushSubscriptions.uses})`,
        officerNow(sql`${pushSubscriptions.workspaceId}`, now),
      ),
    )
    .groupBy(workspaces.id);
}

/** The push service took a push for this device. */
export async function markDelivered(db: Db, ids: number[], now: Date) {
  if (ids.length === 0) return;
  await db
    .update(pushSubscriptions)
    .set({ lastSuccessAt: now })
    .where(inArray(pushSubscriptions.id, ids));
}

/** The push service said the subscription is gone (404, 410), or it cannot be opened: the row goes. */
export async function deleteDevices(db: Db, workspaceId: number, ids: number[]) {
  if (ids.length === 0) return;
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.workspaceId, workspaceId), inArray(pushSubscriptions.id, ids)));
}

/**
 * INVARIANT push.once-per-trigger: true for the one caller that stores a new `value` for the trigger `key`;
 * false when that value is already stored. One statement, so two ticks at once never both win.
 */
export async function claimPushMark(
  db: Db,
  m: { workspaceId: number; key: string; value: string },
  now: Date,
): Promise<boolean> {
  const won = await db
    .insert(pushMarks)
    .values({ ...m, sentAt: now })
    .onConflictDoUpdate({
      target: [pushMarks.workspaceId, pushMarks.key],
      set: { value: m.value, sentAt: now },
      setWhere: sql`${pushMarks.value} is distinct from excluded.value`,
    })
    .returning({ key: pushMarks.key });
  return won.length > 0;
}

/** An officer's row, for the access a roll call reminder's reads are made on. */
export async function officerOf(db: Db, workspaceId: number, userId: number) {
  const [row] = await db
    .select({
      id: workspaceUsers.id,
      displayName: workspaceUsers.displayName,
      chosenName: workspaceUsers.chosenName,
      playerUid: workspaceUsers.playerUid,
    })
    .from(workspaceUsers)
    .where(and(eq(workspaceUsers.workspaceId, workspaceId), eq(workspaceUsers.id, userId)));
  return row ?? null;
}

/** The workspaces of these alliances: a night read that failed for them. */
export async function workspacesOfUnions(db: Db, unionIds: number[]) {
  if (unionIds.length === 0) return [];
  return db
    .select({ id: workspaces.id, slug: workspaces.slug, unionId: workspaces.unionId })
    .from(workspaces)
    .where(inArray(workspaces.unionId, unionIds));
}
