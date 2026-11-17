// The screenshot import's tables (issue 299, D96): drafts, Alliance Duel points and check records, plus
// the roster names and numbers a draft is matched and checked against. Every function takes the
// workspace (or its alliance) from lib/private's WorkspaceAccess; nothing here reads a picture.
import { and, desc, eq, gt, inArray, isNull, lte, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import { dailyRosters, workspaces, workspaceUsers } from "../schema";
import {
  allianceDuelPoints,
  discordPictures,
  screenshotChecks,
  screenshotDrafts,
  type StoredRow,
} from "../schema-import";

export type DraftRow = typeof screenshotDrafts.$inferSelect;
export type NewDraft = Omit<typeof screenshotDrafts.$inferInsert, "id">;

/** How long a saved draft's row stays: as long as Home's recent activity looks back (D108). */
export const SAVED_DRAFT_KEEP_MS = 14 * 24 * 60 * 60_000;

/**
 * Runs when the workspace's list is read or a draft is made. Open and discarded drafts are deleted past
 * their 7 days (D96). A saved draft loses its OCR text and rows at 7 days too, but its row (who saved
 * which kind, and when) stays until the feed's window ends, so the feed keeps one "saved a screenshot"
 * line for the facts, thefts and new members that save wrote (D108, D96 amended 2026-11-17).
 */
async function dropExpired(db: Db, workspaceId: number, now: Date): Promise<void> {
  const d = screenshotDrafts;
  const ours = eq(d.workspaceId, workspaceId);
  const saved = eq(d.status, "saved");
  await db.delete(d).where(and(ours, lte(d.expiresAt, now), ne(d.status, "saved")));
  const kept = new Date(now.getTime() - SAVED_DRAFT_KEEP_MS);
  await db.delete(d).where(and(ours, saved, lte(d.doneAt, kept)));
  await db
    .update(d)
    .set({ pages: [], rows: [] })
    .where(and(ours, saved, lte(d.expiresAt, now), sql`jsonb_array_length(${d.pages}) > 0`));
}

export async function insertDrafts(db: Db, drafts: NewDraft[], now: Date): Promise<number[]> {
  const first = drafts[0];
  if (!first) return [];
  await dropExpired(db, first.workspaceId, now);
  const rows = await db
    .insert(screenshotDrafts)
    .values(drafts)
    .returning({ id: screenshotDrafts.id });
  return rows.map((r) => r.id);
}

/**
 * Claims a Discord message's pictures for one run of the command (D100); claims made before `since` are
 * dropped first. Returns the attachment ids this run claimed: those no earlier run holds.
 */
export async function claimPictures(
  db: Db,
  key: { workspaceId: number; messageId: string },
  attachmentIds: readonly string[],
  now: Date,
  since: Date,
): Promise<string[]> {
  await db
    .delete(discordPictures)
    .where(
      and(eq(discordPictures.workspaceId, key.workspaceId), lte(discordPictures.createdAt, since)),
    );
  if (attachmentIds.length === 0) return [];
  const rows = await db
    .insert(discordPictures)
    .values(attachmentIds.map((attachmentId) => ({ ...key, attachmentId, createdAt: now })))
    .onConflictDoNothing()
    .returning({ id: discordPictures.attachmentId });
  return rows.map((r) => r.id);
}

/** The drafts a message's pictures went into, oldest first, each once. */
export async function picturesDrafts(
  db: Db,
  key: { workspaceId: number; messageId: string },
): Promise<number[]> {
  const rows = await db
    .selectDistinct({ id: discordPictures.draftId })
    .from(discordPictures)
    .where(
      and(
        eq(discordPictures.workspaceId, key.workspaceId),
        eq(discordPictures.messageId, key.messageId),
      ),
    );
  return rows.flatMap((r) => (r.id === null ? [] : [r.id])).sort((a, b) => a - b);
}

/** After the run: each read picture's draft (null: it made none); pictures not read are let go. */
export async function settlePictures(
  db: Db,
  key: { workspaceId: number; messageId: string },
  drafts: ReadonlyMap<string, number | null>,
  unread: readonly string[],
): Promise<void> {
  const own = (ids: string[]) =>
    and(
      eq(discordPictures.workspaceId, key.workspaceId),
      eq(discordPictures.messageId, key.messageId),
      inArray(discordPictures.attachmentId, ids),
    );
  for (const [attachmentId, draftId] of drafts) {
    if (draftId !== null)
      await db
        .update(discordPictures)
        .set({ draftId })
        .where(own([attachmentId]));
  }
  if (unread.length > 0) await db.delete(discordPictures).where(own([...unread]));
}

/** The workspace's drafts waiting for review, newest first. */
export async function openDrafts(db: Db, workspaceId: number, now: Date): Promise<DraftRow[]> {
  await dropExpired(db, workspaceId, now);
  return db
    .select()
    .from(screenshotDrafts)
    .where(and(eq(screenshotDrafts.workspaceId, workspaceId), eq(screenshotDrafts.status, "open")))
    .orderBy(desc(screenshotDrafts.createdAt), desc(screenshotDrafts.id));
}

/** How many drafts wait for review: the badge on the Home tab. */
export async function countOpenDrafts(db: Db, workspaceId: number, now: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(screenshotDrafts)
    .where(
      and(
        eq(screenshotDrafts.workspaceId, workspaceId),
        eq(screenshotDrafts.status, "open"),
        gt(screenshotDrafts.expiresAt, now),
      ),
    );
  return row?.n ?? 0;
}

/** One draft of the workspace with the name of the officer who saved or discarded it; null when gone. */
export async function findDraft(db: Db, workspaceId: number, id: number, now: Date) {
  const [row] = await db
    .select({ draft: screenshotDrafts, doneByName: workspaceUsers.displayName })
    .from(screenshotDrafts)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, screenshotDrafts.doneBy))
    .where(
      and(
        eq(screenshotDrafts.workspaceId, workspaceId),
        eq(screenshotDrafts.id, id),
        gt(screenshotDrafts.expiresAt, now),
      ),
    );
  return row ?? null;
}

const stillOpen = (workspaceId: number, id: number, version: number, now: Date) =>
  and(
    eq(screenshotDrafts.workspaceId, workspaceId),
    eq(screenshotDrafts.id, id),
    eq(screenshotDrafts.status, "open"),
    eq(screenshotDrafts.version, version),
    gt(screenshotDrafts.expiresAt, now),
  );

/** A new type for an open draft at `version`, with its rows read again; false when it changed meanwhile. */
export async function retypeDraft(
  db: Db,
  workspaceId: number,
  id: number,
  version: number,
  change: Pick<DraftRow, "kind" | "scope" | "scopeSure" | "rows" | "leftOut">,
  now: Date,
): Promise<boolean> {
  const done = await db
    .update(screenshotDrafts)
    .set({ ...change, version: version + 1 })
    .where(stillOpen(workspaceId, id, version, now))
    .returning({ id: screenshotDrafts.id });
  return done.length === 1;
}

/**
 * Closes an open draft at `version` as saved or discarded, by `userId`. The first one wins: a second
 * call with the same version finds no open row and gets false. Runs inside the save's transaction.
 */
export async function closeDraft(
  db: Db,
  workspaceId: number,
  id: number,
  version: number,
  close: { status: "saved" | "discarded"; userId: number },
  now: Date,
): Promise<boolean> {
  const done = await db
    .update(screenshotDrafts)
    .set({ status: close.status, version: version + 1, doneBy: close.userId, doneAt: now })
    .where(stillOpen(workspaceId, id, version, now))
    .returning({ id: screenshotDrafts.id });
  return done.length === 1;
}

export type DuelDay = (typeof allianceDuelPoints.$inferSelect)["day"];

/** Writes members' Alliance Duel points for one day or the week; a member's earlier value is replaced. */
export async function saveDuelPoints(
  db: Db,
  workspaceId: number,
  at: { week: string; day: DuelDay },
  points: { uid: number; points: number }[],
  saved: { userId: number; now: Date },
): Promise<void> {
  if (points.length === 0) return;
  await db
    .insert(allianceDuelPoints)
    .values(
      points.map((p) => ({
        workspaceId,
        ...at,
        ...p,
        savedBy: saved.userId,
        savedAt: saved.now,
      })),
    )
    .onConflictDoUpdate({
      target: [
        allianceDuelPoints.workspaceId,
        allianceDuelPoints.week,
        allianceDuelPoints.day,
        allianceDuelPoints.uid,
      ],
      set: {
        points: sql`excluded.points`,
        savedBy: sql`excluded.saved_by`,
        savedAt: sql`excluded.saved_at`,
      },
    });
}

/** The workspace's Alliance Duel points of one game week, every day and the week. */
export async function duelWeek(db: Db, workspaceId: number, week: string) {
  return db
    .select({
      uid: allianceDuelPoints.uid,
      day: allianceDuelPoints.day,
      points: allianceDuelPoints.points,
    })
    .from(allianceDuelPoints)
    .where(and(eq(allianceDuelPoints.workspaceId, workspaceId), eq(allianceDuelPoints.week, week)));
}

export async function insertCheck(
  db: Db,
  row: Omit<typeof screenshotChecks.$inferInsert, "id">,
): Promise<void> {
  await db.insert(screenshotChecks).values(row);
}

/** A usable roster of the alliance (D60): fresh, no error, not empty. */
const usable = (unionId: number) =>
  and(
    eq(dailyRosters.unionId, unionId),
    eq(dailyRosters.isFresh, true),
    isNull(dailyRosters.error),
    gt(dailyRosters.memberCount, 0),
  );

/** One member of the alliance's newest usable daily roster: its name, might and kills (D15: null stays null). */
export interface RosterEntry {
  uid: number;
  name: string;
  might: number | null;
  kills: number | null;
}

/** The alliance's newest usable daily roster; empty before its first one. */
export async function newestRoster(db: Db, unionId: number): Promise<RosterEntry[]> {
  const [row] = await db
    .select({
      uids: dailyRosters.memberUids,
      names: dailyRosters.memberNames,
      power: dailyRosters.memberPower,
      kills: dailyRosters.memberKills,
    })
    .from(dailyRosters)
    .where(usable(unionId))
    .orderBy(desc(dailyRosters.readDay))
    .limit(1);
  if (!row) return [];
  return row.uids.map((uid, i) => ({
    uid,
    name: row.names[i] ?? "",
    might: row.power[i] ?? null,
    kills: row.kills[i] ?? null,
  }));
}

/** The names `uids` had in the alliance's usable daily rosters since `since` (a server day): name history. */
export async function pastNames(
  db: Db,
  unionId: number,
  uids: number[],
  since: string,
): Promise<{ uid: number; name: string }[]> {
  if (uids.length === 0) return [];
  const result = await db.execute<{ uid: string; name: string }>(sql`
    select distinct u.uid::text as uid, u.name
    from daily_rosters r cross join lateral unnest(r.member_uids, r.member_names) as u(uid, name)
    where r.union_id = ${unionId} and r.is_fresh and r.error is null and r.member_count > 0
      and r.read_day >= ${since} and u.uid in (${sql.join(
        uids.map((uid) => sql`${uid}`),
        sql`, `,
      )})`);
  return result.rows.map((r) => ({ uid: Number(r.uid), name: r.name }));
}

/** The workspace whose Discord server this is: the Discord command's way in; null when none. */
export async function findWorkspaceByGuild(db: Db, guildId: string) {
  const [row] = await db.select().from(workspaces).where(eq(workspaces.discordGuildId, guildId));
  return row ?? null;
}

/**
 * The officer who used the Discord command, as one of the workspace's people (D73 stores who gets in):
 * the row is made or its Discord name updated, without touching the last sign-in. Returns the row's id,
 * the name the officer chose in the desk and their linked player.
 */
export async function recordOfficer(
  db: Db,
  workspaceId: number,
  discordUserId: string,
  displayName: string,
) {
  const [row] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId, displayName })
    .onConflictDoUpdate({
      target: [workspaceUsers.workspaceId, workspaceUsers.discordUserId],
      set: { displayName },
    })
    .returning({
      id: workspaceUsers.id,
      displayName: workspaceUsers.displayName,
      chosenName: workspaceUsers.chosenName,
      playerUid: workspaceUsers.playerUid,
    });
  if (!row) throw new Error("workspace user upsert returned no row");
  return row;
}

export type { StoredRow };
