// Home's "On the desk now" and "Recent activity" (D108): who else had the desk open in the last minutes, and
// what officers did, read from the histories the desk already keeps. Five reads at once, each returning at
// most the newest `n` actions per source since `from` and before a page's cursor; lib/private merges them.
// Only who, when and which thing: never a member field's value, a follow-up note or a theft's note or people.
import { and, desc, eq, gt, gte, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import { memberFacts, workspaceSessions, workspaceUsers } from "../schema";
import { thefts } from "../schema-thefts";
import { callParts, callRows, type CallKind, type CallRows } from "./desk-activity-calls";
import * as garrison from "./desk-activity-garrison";
import * as picture from "./desk-activity-pictures";
import { reviewParts, reviewRows, type ReviewKind, type ReviewRows } from "./desk-activity-reviews";
import { thanksParts, type ThanksDone } from "./desk-activity-thanks";
import { trashParts, trashRows, type TrashKind, type TrashRows } from "./desk-activity-trash";

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
/** `source`: desk or discord (pictures), or pasted (Members' "Paste updates", D109). */
export type DraftDone = Done & { kind: string; scope: string | null; source: string };
export type EntryDone = Done & {
  kind: string;
  variant: string | null;
  level: number | null;
  title: string | null;
};
/** Marks one officer wrote in one roll call within an hour; `rest` when written by "the rest". */
export type MarksDone = Done & { kind: string; variant: string | null; rest: boolean };
/** A follow-up record: the choice and, for a break, the last day away; never the note. */
export type FollowUpDone = Done & {
  uid: number;
  action: "talked" | "break" | "help" | "fine";
  until: string | null;
};
export type TheftsDone = Done & { count: number };
export type NewMemberDone = Done & { name: string };
export interface ActivityRows extends ReviewRows, TrashRows, picture.Rows, CallRows, garrison.Rows {
  facts: FactsDone[];
  noticeSaves: NoticeDone[];
  noticePosts: NoticeDone[];
  drafts: DraftDone[];
  entries: EntryDone[];
  entryEdits: EntryDone[];
  marks: MarksDone[];
  followUps: FollowUpDone[];
  thefts: TheftsDone[];
  newMembers: NewMemberDone[];
  thanks: ThanksDone[];
}

/** The page's bounds: since `from`, and before `before` (an ISO time, or "infinity" for the first page). */
type Span = readonly [from: Date, before: string];

function factSaves(db: Db, ws: number, [from, before]: Span, n: number) {
  const f = memberFacts;
  return db
    .select({
      by: f.writtenBy,
      at: f.writtenAt,
      uid: sql<number>`min(${f.uid})`.mapWith(Number),
      members: sql<number>`count(distinct ${f.uid})`.mapWith(Number),
    })
    .from(f)
    .where(
      and(
        eq(f.workspaceId, ws),
        isNotNull(f.writtenBy),
        gte(f.writtenAt, from),
        lt(f.writtenAt, sql`${before}::timestamptz`),
      ),
    )
    .groupBy(f.writtenBy, f.writtenAt)
    .orderBy(desc(f.writtenAt))
    .limit(n);
}

type OwnKind = "noticeSaved" | "noticePosted" | "draft" | "entry" | "newMember" | "followUp";

/** One row of the small sources' read; the columns each kind does not use are null. */
type SmallRow = {
  kind: OwnKind | ReviewKind | TrashKind | picture.Kind | CallKind | garrison.Kind | "thanks";
  by: number | string;
  at: Date | string;
  notice_id: number | null;
  a: string | null;
  b: string | null;
  level: number | null;
  title: string | null;
  uid: number | string | null;
};

/**
 * The small sources in one read (one connection): notice saves (one per save of any number of fields),
 * notice posts, notices deleted and restored from the trash (D118; an undone delete is not one), Calendar entries, thefts and new members deleted (D123), saved drafts, calendar entries added, new members added by hand, and follow-up records
 * (not `withdrawn`, and not one an Undo cancelled), notice review requests and their outcomes (D113), and
 * the weekly thanks shared or taken down (D114), notice pictures added (D119), and roll calls deleted or archived (D120). Each part is its own newest `n` since `from`; `n` bounds
 * the rows returned, not the rows a part scans. A deleted entry or new member has no "added" line.
 */
async function smallSources(
  db: Db,
  ws: number,
  [from, before]: Span,
  n: number,
): Promise<SmallRow[]> {
  const since = from.toISOString();
  const result = await db.execute<SmallRow>(sql`
    (select 'noticeSaved' as kind, e.edited_by as by, e.edited_at as at, e.notice_id,
        null::text as a, null::text as b, null::int as level, null::text as title, null::bigint as uid
      from notice_edits e
      where e.workspace_id = ${ws} and e.edited_by is not null and e.edited_at >= ${since}
        and e.edited_at < ${before}
      group by e.notice_id, e.edited_by, e.edited_at order by e.edited_at desc limit ${n})
    union all
    (select 'noticePosted', p.published_by, p.published_at, p.notice_id, null, null, null, null, null
      from notice_publishes p
      where p.workspace_id = ${ws} and p.status = 'posted' and p.published_by is not null
        and p.published_at >= ${since} and p.published_at < ${before}
      order by p.published_at desc limit ${n})
    union all
    (select 'draft', d.done_by, d.done_at, null, d.kind, d.scope, null, d.source, null
      from screenshot_drafts d
      where d.workspace_id = ${ws} and d.status = 'saved' and d.done_by is not null
        and d.done_at >= ${since} and d.done_at < ${before}
      order by d.done_at desc limit ${n})
    union all
    (select 'entry', c.created_by, c.created_at, null, c.kind, c.variant, c.level, c.title, null
      from calendar_entries c
      where c.workspace_id = ${ws} and c.created_by is not null and c.created_at >= ${since}
        and c.created_at < ${before} and c.deleted_at is null
      order by c.created_at desc limit ${n})
    union all
    (select 'newMember', m.created_by, m.created_at, null, null, null, null, m.name, null
      from pending_members m
      where m.workspace_id = ${ws} and m.created_by is not null and m.created_at >= ${since}
        and m.created_at < ${before} and m.dismissed_at is null
      order by m.created_at desc limit ${n})
    union all
    (select 'followUp', f.written_by, f.written_at, null, f.action, f.until, null, null, f.uid
      from member_follow_ups f
      where f.workspace_id = ${ws} and f.written_by is not null and f.action <> 'withdrawn'
        and f.written_at >= ${since} and f.written_at < ${before}
        -- Undo appends "withdrawn" right after the record it cancels (D104): neither is shown.
        and coalesce((select x.action from member_follow_ups x
          where x.workspace_id = f.workspace_id and x.uid = f.uid and x.id > f.id
          order by x.id limit 1), '') <> 'withdrawn'
      order by f.written_at desc limit ${n})
    ${reviewParts(ws, since, before, n)}
    ${thanksParts(ws, since, before, n)}
    ${trashParts(ws, since, before, n)}
    ${picture.parts(ws, since, before, n)}
    ${callParts(ws, since, before, n)}
    ${garrison.parts(ws, since, before, n)}`);
  return result.rows;
}

/**
 * Calendar edits: each field of an entry and of its week rows keeps who changed it last and when (`edits`,
 * issue 293), so one change of several fields is one line. Only the newest change of each field is kept
 * there, so an older change that a later one overwrote is not in the feed.
 */
async function entriesEdited(
  db: Db,
  ws: number,
  [from, before]: Span,
  n: number,
): Promise<EntryDone[]> {
  const result = await db.execute<{
    by: number | string;
    at: Date | string;
    kind: string;
    variant: string | null;
    level: number | null;
    title: string | null;
  }>(sql`
    with x as (
      select c.id, e.value->>'by' as by, (e.value->>'at')::timestamptz as at
      from calendar_entries c cross join lateral jsonb_each(c.edits) e
      where c.workspace_id = ${ws}
      union all
      select o.entry_id, e.value->>'by', (e.value->>'at')::timestamptz
      from calendar_occurrences o cross join lateral jsonb_each(o.edits) e
      where o.workspace_id = ${ws}
    )
    select x.by, x.at, c.kind, c.variant, c.level, c.title
    from x join calendar_entries c on c.id = x.id
    where x.by is not null and x.at >= ${from.toISOString()} and x.at < ${before}
      and c.deleted_at is null
    group by x.id, x.by, x.at, c.kind, c.variant, c.level, c.title
    order by x.at desc limit ${n}`);
  return result.rows.map((r) => ({ ...r, by: Number(r.by), at: new Date(r.at) }));
}

/**
 * Roll call marks, one line per action and never one per member: the marks one officer wrote at one
 * instant are one action ("the rest" when more than one), and single taps on one roll call within the
 * same hour are one line. A line falls before or after a page's cursor by its newest mark, whole.
 */
async function marksWritten(
  db: Db,
  ws: number,
  [from, before]: Span,
  n: number,
): Promise<MarksDone[]> {
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
      where c.workspace_id = ${ws} and c.deleted_at is null
        and m.written_by is not null and m.mark is not null
        and m.written_at >= ${from.toISOString()}
      group by m.roll_call_id, m.written_by, m.written_at
    )
    select g.written_by as by, max(g.written_at) as at, c.kind, c.variant, g.rest
    from g join roll_calls c on c.id = g.roll_call_id
    group by g.roll_call_id, g.written_by, g.rest, date_trunc('hour', g.written_at), c.kind, c.variant
    having max(g.written_at) < ${before}
    order by at desc limit ${n}`);
  return result.rows.map((r) => ({ ...r, by: Number(r.by), at: new Date(r.at) }));
}

function theftsAdded(db: Db, ws: number, [from, before]: Span, n: number) {
  const t = thefts;
  return db
    .select({ by: t.createdBy, at: t.createdAt, count: sql<number>`count(*)`.mapWith(Number) })
    .from(t)
    .where(
      and(
        eq(t.workspaceId, ws),
        isNull(t.deletedAt),
        isNotNull(t.createdBy),
        gte(t.createdAt, from),
        lt(t.createdAt, sql`${before}::timestamptz`),
      ),
    )
    .groupBy(t.createdBy, t.createdAt)
    .orderBy(desc(t.createdAt))
    .limit(n);
}

/** Splits the small sources' rows by kind, typed. */
function split(rows: SmallRow[]) {
  const of = <K extends SmallRow["kind"]>(kind: K) =>
    rows
      .filter((r) => r.kind === kind)
      .map((r) => ({ ...r, by: Number(r.by), at: new Date(r.at) }));
  const notice = (kind: "noticeSaved" | "noticePosted" | TrashKind | picture.Kind) =>
    of(kind).map(({ by, at, notice_id }) => ({ by, at, noticeId: Number(notice_id) }));
  return {
    noticeSaves: notice("noticeSaved"),
    noticePosts: notice("noticePosted"),
    ...trashRows(notice, of),
    ...picture.rows(notice, of("noticePictureReused")),
    drafts: of("draft").map(({ by, at, a, b, title }) => ({
      by,
      at,
      kind: a ?? "",
      scope: b,
      source: title ?? "desk",
    })),
    entries: of("entry").map(({ by, at, a, b, level, title }) => ({
      by,
      at,
      kind: a ?? "",
      variant: b,
      level,
      title,
    })),
    newMembers: of("newMember").map(({ by, at, title }) => ({ by, at, name: title ?? "" })),
    ...reviewRows(of("reviewAsked"), of("reviewAnswered")),
    followUps: of("followUp").map(({ by, at, a, b, uid }) => ({
      by,
      at,
      uid: Number(uid),
      action: a as FollowUpDone["action"],
      until: b,
    })),
    thanks: of("thanks").map(({ by, at, a }) => ({ by, at, target: a as ThanksDone["target"] })),
    ...callRows(of),
    ...garrison.rows(of),
  };
}

/**
 * The newest `n` actions of each source since `from` and before `before` (null: no upper bound, the first
 * page): five reads at once (member facts, calendar edits, roll call marks, thefts, and the small sources
 * together).
 */
export async function activityRows(
  db: Db,
  workspaceId: number,
  from: Date,
  before: Date | null,
  n: number,
): Promise<ActivityRows> {
  const span: Span = [from, before?.toISOString() ?? "infinity"];
  const args = [db, workspaceId, span, n] as const;
  const [facts, small, edits, marks, stolen] = await Promise.all([
    factSaves(...args),
    smallSources(...args),
    entriesEdited(...args),
    marksWritten(...args),
    theftsAdded(...args),
  ]);
  return { ...split(small), facts: known(facts), entryEdits: edits, marks, thefts: known(stolen) };
}
