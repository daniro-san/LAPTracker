// Home's "On the desk now" and "Recent activity" (D108): who else had the desk open in the last minutes, and
// what officers did, read from the histories the desk already keeps. One bounded read per source (the
// newest `n` actions since `from`), merged in lib/private. Only who, when and which thing: never a member
// field's value, a follow-up note or a theft's note or people.
import { and, desc, eq, gt, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import {
  calendarEntries,
  dailyRosters,
  memberFacts,
  memberFollowUps,
  pendingMembers,
  workspaceSessions,
  workspaceUsers,
} from "../schema";
import { screenshotDrafts } from "../schema-import";
import { noticeEdits, noticePublishes } from "../schema-notices";
import { thefts } from "../schema-thefts";
import { usable } from "./workspace-rosters";

/** The officers, other than `me`, whose desk session was seen since `since` and is still open. */
export async function officersSeen(
  db: Db,
  workspaceId: number,
  me: number,
  since: Date,
  now: Date,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({
      name: sql<
        string | null
      >`coalesce(${workspaceUsers.chosenName}, ${workspaceUsers.displayName})`,
    })
    .from(workspaceSessions)
    .innerJoin(workspaceUsers, eq(workspaceUsers.id, workspaceSessions.workspaceUserId))
    .where(
      and(
        eq(workspaceSessions.workspaceId, workspaceId),
        eq(workspaceSessions.tier, "officer"),
        gte(workspaceSessions.seenAt, since),
        gt(workspaceSessions.expiresAt, now),
        eq(workspaceUsers.blocked, false),
        ne(workspaceUsers.id, me),
      ),
    );
  return rows.flatMap((r) => (r.name ? [r.name] : [])).sort((a, b) => a.localeCompare(b));
}

/** What every source row carries: the officer and when. */
interface Done {
  by: number;
  at: Date;
}

/** Rows whose officer is known (an officer's account deleted later leaves null). */
const known = <R extends { by: number | null }>(rows: R[]) =>
  rows.flatMap((r) => (r.by === null ? [] : [{ ...r, by: r.by }]));

/** One save of member facts: who, when, and the member (or how many members, for a batch). */
export type FactsDone = Done & { uid: number; members: number };
export type NoticeDone = Done & { noticeId: number };
export type DraftDone = Done & { kind: string; scope: string | null };
export type EntryDone = Done & {
  kind: string;
  variant: string | null;
  level: number | null;
  title: string | null;
};
/** Marks one officer wrote in one roll call within an hour; `rest` when written by "the rest". */
export type MarksDone = Done & { kind: string; variant: string | null; rest: boolean };
export type FollowUpDone = Done & { uid: number };
export type TheftsDone = Done & { count: number };
export type NewMemberDone = Done & { name: string };

export interface ActivityRows {
  facts: FactsDone[];
  noticeSaves: NoticeDone[];
  noticePosts: NoticeDone[];
  drafts: DraftDone[];
  entries: EntryDone[];
  marks: MarksDone[];
  followUps: FollowUpDone[];
  thefts: TheftsDone[];
  newMembers: NewMemberDone[];
}

function factSaves(db: Db, ws: number, from: Date, n: number) {
  const f = memberFacts;
  return db
    .select({
      by: f.writtenBy,
      at: f.writtenAt,
      uid: sql<number>`min(${f.uid})`.mapWith(Number),
      members: sql<number>`count(distinct ${f.uid})`.mapWith(Number),
    })
    .from(f)
    .where(and(eq(f.workspaceId, ws), isNotNull(f.writtenBy), gte(f.writtenAt, from)))
    .groupBy(f.writtenBy, f.writtenAt)
    .orderBy(desc(f.writtenAt))
    .limit(n);
}

function noticeSaves(db: Db, ws: number, from: Date, n: number) {
  const e = noticeEdits;
  return db
    .select({ by: e.editedBy, at: e.editedAt, noticeId: e.noticeId })
    .from(e)
    .where(and(eq(e.workspaceId, ws), isNotNull(e.editedBy), gte(e.editedAt, from)))
    .groupBy(e.noticeId, e.editedBy, e.editedAt)
    .orderBy(desc(e.editedAt))
    .limit(n);
}

function noticePosts(db: Db, ws: number, from: Date, n: number) {
  const p = noticePublishes;
  return db
    .select({ by: p.publishedBy, at: p.publishedAt, noticeId: p.noticeId })
    .from(p)
    .where(and(eq(p.workspaceId, ws), eq(p.status, "posted"), gte(p.publishedAt, from)))
    .orderBy(desc(p.publishedAt))
    .limit(n);
}

function draftsSaved(db: Db, ws: number, from: Date, n: number) {
  const d = screenshotDrafts;
  return db
    .select({ by: d.doneBy, done: d.doneAt, kind: d.kind, scope: d.scope })
    .from(d)
    .where(and(eq(d.workspaceId, ws), eq(d.status, "saved"), gte(d.doneAt, from)))
    .orderBy(desc(d.doneAt))
    .limit(n);
}

function entriesAdded(db: Db, ws: number, from: Date, n: number) {
  const c = calendarEntries;
  const fields = { kind: c.kind, variant: c.variant, level: c.level, title: c.title };
  return db
    .select({ by: c.createdBy, at: c.createdAt, ...fields })
    .from(c)
    .where(and(eq(c.workspaceId, ws), gte(c.createdAt, from)))
    .orderBy(desc(c.createdAt))
    .limit(n);
}

/**
 * Roll call marks, one line per action and never one per member: the marks one officer wrote at one
 * instant are one action ("the rest" when more than one), and single taps on one roll call within the
 * same hour are one line.
 */
async function marksWritten(db: Db, ws: number, from: Date, n: number): Promise<MarksDone[]> {
  const result = await db.execute<{
    by: number | string;
    at: Date | string;
    kind: string;
    variant: string | null;
    rest: boolean;
  }>(sql`
    with g as (
      select m.roll_call_id, m.written_by, m.written_at, count(*) > 1 as rest
      from roll_call_marks m join roll_calls c on c.id = m.roll_call_id
      where c.workspace_id = ${ws} and m.written_by is not null and m.mark is not null
        and m.written_at >= ${from.toISOString()}
      group by m.roll_call_id, m.written_by, m.written_at
    )
    select g.written_by as by, max(g.written_at) as at, c.kind, c.variant, g.rest
    from g join roll_calls c on c.id = g.roll_call_id
    group by g.roll_call_id, g.written_by, g.rest, date_trunc('hour', g.written_at), c.kind, c.variant
    order by at desc limit ${n}`);
  return result.rows.map((r) => ({ ...r, by: Number(r.by), at: new Date(r.at) }));
}

function followUps(db: Db, ws: number, from: Date, n: number) {
  const f = memberFollowUps;
  return db
    .select({ by: f.writtenBy, at: f.writtenAt, uid: f.uid })
    .from(f)
    .where(and(eq(f.workspaceId, ws), ne(f.action, "withdrawn"), gte(f.writtenAt, from)))
    .orderBy(desc(f.writtenAt))
    .limit(n);
}

function theftsAdded(db: Db, ws: number, from: Date, n: number) {
  const t = thefts;
  return db
    .select({ by: t.createdBy, at: t.createdAt, count: sql<number>`count(*)`.mapWith(Number) })
    .from(t)
    .where(and(eq(t.workspaceId, ws), isNotNull(t.createdBy), gte(t.createdAt, from)))
    .groupBy(t.createdBy, t.createdAt)
    .orderBy(desc(t.createdAt))
    .limit(n);
}

function membersAdded(db: Db, ws: number, from: Date, n: number) {
  const p = pendingMembers;
  return db
    .select({ by: p.createdBy, at: p.createdAt, name: p.name })
    .from(p)
    .where(and(eq(p.workspaceId, ws), gte(p.createdAt, from)))
    .orderBy(desc(p.createdAt))
    .limit(n);
}

/** The newest `n` actions of each source since `from`, all read at once. */
export async function activityRows(
  db: Db,
  workspaceId: number,
  from: Date,
  n: number,
): Promise<ActivityRows> {
  const args = [db, workspaceId, from, n] as const;
  const [facts, saves, posts, drafts, entries, marks, follows, stolen, added] = await Promise.all([
    factSaves(...args),
    noticeSaves(...args),
    noticePosts(...args),
    draftsSaved(...args),
    entriesAdded(...args),
    marksWritten(...args),
    followUps(...args),
    theftsAdded(...args),
    membersAdded(...args),
  ]);
  return {
    facts: known(facts),
    noticeSaves: known(saves),
    noticePosts: known(posts),
    // A saved draft always has its time; the filter only narrows the type.
    drafts: known(drafts).flatMap(({ done, ...d }) => (done ? [{ ...d, at: done }] : [])),
    entries: known(entries),
    marks,
    followUps: known(follows),
    thefts: known(stolen),
    newMembers: known(added),
  };
}

/**
 * The names of these members: from the alliance's newest usable roster, and for a new member added by
 * hand (a negative uid, D106) from that record. A uid found in neither has no name.
 */
export async function memberNames(
  db: Db,
  workspaceId: number,
  unionId: number,
  uids: number[],
): Promise<Map<number, string>> {
  const pendingIds = uids.filter((u) => u < 0).map((u) => -u);
  const [[roster], pending] = await Promise.all([
    db
      .select({ uids: dailyRosters.memberUids, names: dailyRosters.memberNames })
      .from(dailyRosters)
      .where(usable(unionId))
      .orderBy(desc(dailyRosters.readDay))
      .limit(1),
    pendingIds.length === 0
      ? []
      : db
          .select({ id: pendingMembers.id, name: pendingMembers.name })
          .from(pendingMembers)
          .where(
            and(
              eq(pendingMembers.workspaceId, workspaceId),
              inArray(pendingMembers.id, pendingIds),
            ),
          ),
  ]);
  const wanted = new Set(uids);
  const names = new Map<number, string>();
  roster?.uids.forEach((uid, i) => {
    if (wanted.has(uid) && roster.names[i]) names.set(uid, roster.names[i]);
  });
  for (const p of pending) names.set(-p.id, p.name);
  return names;
}
