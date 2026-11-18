// Home's "On the desk now" and "Recent activity" (D108). Presence comes from officer sessions only (a
// member's session on the board never counts, the game's online flag is not used). The feed merges the
// newest actions of each history in memory: newest first, one line per action, the same action repeated
// by the same officer on the same thing shown once, and one officer's run of the same kind on one server
// day as one line that opens to its lines. It reads a page at a time, before a cursor (D108, 2026-11-18).
// People first (D75): no counts per officer, no list of who is away, and only what was worked on, never a
// member's values or a note.
import type { Db } from "../db";
import { officerNames } from "../repo/calendar";
import {
  activityRows,
  officersSeen,
  type ActivityRows,
  type DraftDone,
  type EntryDone,
  type FollowUpDone,
  type MarksDone,
} from "../repo/desk-activity";
import { memberNames } from "../repo/desk-activity-names";
import type { ReviewAnsweredDone, ReviewAskedDone } from "../repo/desk-activity-reviews";
import { SAVED_DRAFT_KEEP_MS } from "../repo/import";
import { noticeTitles } from "../repo/notices";
import { serverDay } from "../schedule";
import type { WorkspaceAccess } from "./access";

/** "On the desk now": a session seen in the last ten minutes. */
export const ON_DESK_MS = 10 * 60_000;
/** The feed looks back two weeks: as long as a saved draft's row is kept (D108). */
export const ACTIVITY_WINDOW_MS = SAVED_DRAFT_KEEP_MS;
/** Home shows the first ACTIVITY_FIRST lines; each "Show more" reads ACTIVITY_PAGE more. */
export const ACTIVITY_FIRST = 6;
export const ACTIVITY_PAGE = 20;
/** The most rows each source returns for one page. */
const PER_SOURCE = 40;

/** The other officers on the desk now, by name; the officer looking is left out. */
export function onDeskNow(db: Db, access: WorkspaceAccess, now: Date): Promise<string[]> {
  const since = new Date(now.getTime() - ON_DESK_MS);
  return officersSeen(db, access.workspaceId, access.user.id, since, now);
}

type What =
  /** `uids`: members saved one at a time; `batch`: members of batch saves (a sheet import). */
  | { kind: "facts"; uids: number[]; batch: number }
  | { kind: "noticeSaved" | "noticePosted" | "noticeDeleted" | "noticeRestored"; noticeId: number }
  | { kind: "draft"; draft: Pick<DraftDone, "kind" | "scope" | "source"> }
  | { kind: "entry" | "entryEdit"; entry: Pick<EntryDone, "kind" | "variant" | "level" | "title"> }
  | { kind: "marks"; call: Pick<MarksDone, "kind" | "variant">; rest: boolean }
  | ({ kind: "followUp" } & Pick<FollowUpDone, "uid" | "action" | "until">)
  | { kind: "thefts"; count: number }
  | { kind: "newMember"; names: string[] }
  | ({ kind: "reviewAsked" } & Pick<ReviewAskedDone, "noticeId" | "language" | "reviewerId">)
  | ({ kind: "reviewAnswered" } & Pick<ReviewAnsweredDone, "noticeId" | "outcome" | "language">)
  | { kind: "thanks"; target: "discord" | "board" | "down" };

type Raw = What & { by: number; at: Date };

/** One line of the feed: who did what, and when. */
export type ActivityItem = { at: Date; who: string } & (
  | Exclude<
      What,
      {
        kind:
          | "facts"
          | "followUp"
          | "noticeSaved"
          | "noticePosted"
          | "noticeDeleted"
          | "noticeRestored"
          | "reviewAsked"
          | "reviewAnswered";
      }
    >
  | { kind: "facts"; member: string | null; members: number }
  | ({ kind: "followUp"; member: string | null } & Pick<FollowUpDone, "action" | "until">)
  | { kind: "noticeSaved" | "noticePosted" | "noticeDeleted" | "noticeRestored"; title: string }
  /** `reviewer` null: the whole team (D113). */
  | { kind: "reviewAsked"; title: string; language: string | null; reviewer: string | null }
  | ({ kind: "reviewAnswered"; title: string } & Pick<ReviewAnsweredDone, "outcome" | "language">)
);

/**
 * A draft's save also writes facts, thefts and new members, and a follow-up writes facts, all at the same
 * instant by the same officer: the higher action stands for them. A save from a review request is said
 * as "edited … after a review" (D113), not as a plain save.
 */
const RANK: Partial<Record<What["kind"], number>> = {
  draft: 3,
  followUp: 2,
  newMember: 1,
  reviewAnswered: 1,
};
const rank = (r: Raw) => RANK[r.kind] ?? 0;
const instant = (r: Raw) => `${r.by}@${r.at.getTime()}`;

/** What makes two lines the same: the action and its object, without the time. */
const sameKey = (r: Raw) => JSON.stringify({ ...r, at: 0 });

/** Kinds whose run line counts its different lines: "Rook added 6 entries to the Calendar". */
export const COUNTED_RUNS = ["entry", "entryEdit", "noticeSaved", "draft"] as const;
/**
 * Kinds whose consecutive lines by one officer become one line: the counted ones, and member info saves,
 * thefts added and new members added, which say what the run holds ("Ana updated 9 members"). A post, a
 * delete, a roll call, a follow-up, a review or the thanks is never folded into a run.
 */
const GROUPED = new Set<What["kind"]>([...COUNTED_RUNS, "facts", "thefts", "newMember"]);

/** The newest line of a run with the next one joined in: what the run holds, at the newest time. */
function joined(a: Raw, b: Raw): Raw {
  if (a.kind === "facts" && b.kind === "facts") {
    return { ...a, uids: [...a.uids, ...b.uids], batch: a.batch + b.batch };
  }
  if (a.kind === "thefts" && b.kind === "thefts") return { ...a, count: a.count + b.count };
  if (a.kind === "newMember" && b.kind === "newMember") {
    return { ...a, names: [...a.names, ...b.names] };
  }
  return a;
}

/** One line of the feed: one action, or one officer's run of one kind (`lines`, newest first). */
interface Run {
  head: Raw;
  lines: Raw[];
  /** The oldest action the line stands for, repeats included: where the next page starts. */
  oldest: Date;
}

/**
 * Lines in time order as the feed's lines. The same line repeated in a row is shown once, at its newest
 * time. One officer's consecutive lines of a grouped kind on the same server day are one run (2026-11-18,
 * issue 410); any other line in between, another officer's included, ends the run.
 */
function runs(lines: Raw[], zone: string): Run[] {
  const day = (at: Date) => serverDay(at, { SERVER_TZ: zone });
  const out: Run[] = [];
  for (const r of lines) {
    const run = out.at(-1);
    const last = run?.lines.at(-1);
    if (run && last && sameKey(r) === sameKey(last)) {
      run.oldest = r.at;
    } else if (
      run &&
      GROUPED.has(r.kind) &&
      r.kind === run.head.kind &&
      r.by === run.head.by &&
      day(r.at) === day(run.head.at)
    ) {
      run.head = joined(run.head, r);
      run.lines.push(r);
      run.oldest = r.at;
    } else {
      out.push({ head: r, lines: [r], oldest: r.at });
    }
  }
  return out;
}

/**
 * Each source returns at most `n` rows, so below the oldest row of a source that returned `n` the read
 * may miss rows: the page keeps only what is newer than that (null: every source returned fewer).
 */
function horizon(rows: ActivityRows, n: number): number | null {
  let h: number | null = null;
  for (const list of Object.values(rows) as { at: Date }[][]) {
    if (list.length < n) continue;
    const oldest = Math.min(...list.map((r) => r.at.getTime()));
    h = Math.max(h ?? oldest, oldest);
  }
  return h;
}

/**
 * The first `size` lines and where the next page starts. An instant is never split between two pages, so
 * a page starting strictly before the cursor has no line twice and misses none. When a source was read
 * short and the read ran out, the last run may go on in rows not read yet: it waits for the next page.
 */
function cut(all: Run[], size: number, short: boolean): { page: Run[]; next: Date | null } {
  let end = Math.min(size, all.length);
  if (short && end === all.length && end > 1) end -= 1;
  for (let next = all[end]; next && next.head.at >= (all[end - 1]?.oldest ?? next.head.at);) {
    end += 1;
    next = all[end];
  }
  const last = all[end - 1];
  return {
    page: all.slice(0, end),
    next: last && (end < all.length || short) ? last.oldest : null,
  };
}

/** Every source's rows newer than `after` as feed lines, merged: newest first, covered lines dropped. */
function merge(rows: ActivityRows, after: number | null): Raw[] {
  const raw: Raw[] = [
    ...rows.facts.map(({ by, at, uid, members }) => ({
      by,
      at,
      kind: "facts" as const,
      uids: members === 1 ? [uid] : [],
      batch: members === 1 ? 0 : members,
    })),
    ...rows.noticeSaves.map((r) => ({ ...r, kind: "noticeSaved" as const })),
    ...rows.noticePosts.map((r) => ({ ...r, kind: "noticePosted" as const })),
    ...rows.noticeDeletes.map((r) => ({ ...r, kind: "noticeDeleted" as const })),
    ...rows.noticeRestores.map((r) => ({ ...r, kind: "noticeRestored" as const })),
    ...rows.drafts.map(({ by, at, ...draft }) => ({ by, at, kind: "draft" as const, draft })),
    ...rows.entries.map(({ by, at, ...entry }) => ({ by, at, kind: "entry" as const, entry })),
    ...rows.entryEdits.map(({ by, at, ...entry }) => ({
      by,
      at,
      kind: "entryEdit" as const,
      entry,
    })),
    ...rows.marks.map(({ by, at, rest, ...call }) => ({
      by,
      at,
      rest,
      kind: "marks" as const,
      call,
    })),
    ...rows.followUps.map((r) => ({ ...r, kind: "followUp" as const })),
    ...rows.thefts.map((r) => ({ ...r, kind: "thefts" as const })),
    ...rows.newMembers.map(({ by, at, name }) => ({
      by,
      at,
      kind: "newMember" as const,
      names: [name],
    })),
    ...rows.reviewsAsked.map((r) => ({ ...r, kind: "reviewAsked" as const })),
    ...rows.reviewsAnswered.map((r) => ({ ...r, kind: "reviewAnswered" as const })),
    ...rows.thanks.map((r) => ({ ...r, kind: "thanks" as const })),
  ];
  const read = raw.filter((r) => after === null || r.at.getTime() > after);
  const top = new Map<string, number>();
  for (const r of read) top.set(instant(r), Math.max(top.get(instant(r)) ?? 0, rank(r)));
  return read
    .filter((r) => rank(r) >= (top.get(instant(r)) ?? 0))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

/**
 * A line about a notice, with its title: a save, a post, a review request and the officer it names, or how
 * a review ended (D113).
 */
function noticeItem(
  line: Extract<Raw, { noticeId: number }>,
  who: string,
  titles: Map<number, string>,
  officers: Map<number, string>,
): ActivityItem {
  const title = titles.get(line.noticeId) ?? "";
  if (line.kind === "reviewAnswered") {
    const { at, outcome, language } = line;
    return { kind: "reviewAnswered", at, who, title, outcome, language };
  }
  if (line.kind === "reviewAsked") {
    const reviewer = line.reviewerId === null ? null : (officers.get(line.reviewerId) ?? null);
    return { kind: "reviewAsked", at: line.at, who, title, language: line.language, reviewer };
  }
  return { kind: line.kind, at: line.at, who, title };
}

/** A source line as a feed line with its names; null when the officer's account is gone. */
function itemOf(
  r: Raw,
  names: {
    officers: Map<number, string>;
    members: Map<number, string>;
    titles: Map<number, string>;
  },
): ActivityItem | null {
  const who = names.officers.get(r.by);
  if (!who) return null;
  if ("noticeId" in r) return noticeItem(r, who, names.titles, names.officers);
  switch (r.kind) {
    case "facts": {
      const one = new Set(r.uids);
      const [uid] = [...one];
      const member = one.size === 1 && r.batch === 0 ? (names.members.get(uid ?? 0) ?? null) : null;
      return { kind: "facts", at: r.at, who, member, members: one.size + r.batch };
    }
    case "followUp": {
      const { at, action, until } = r;
      return { kind: "followUp", at, action, until, who, member: names.members.get(r.uid) ?? null };
    }
    default:
      return { ...r, who };
  }
}

/**
 * One line of the feed. `run` holds the lines of a grouped run, newest first (empty for a single action),
 * and `n` how many different things the run's lines are about.
 */
export interface ActivityLine {
  item: ActivityItem;
  run: ActivityItem[];
  n: number;
}

/** A page of the feed, and the cursor of the next one (null: nothing older in the two weeks). */
export interface ActivityPage {
  lines: ActivityLine[];
  next: Date | null;
}

/**
 * The newest `size` lines of what officers did in the last two weeks before `before` (null: the newest),
 * with names resolved. Home reads the first page; "Show more" reads the next ones with the cursor.
 */
export async function activityPage(
  db: Db,
  access: WorkspaceAccess,
  { now, zone }: { now: Date; zone: string },
  before: Date | null,
  size: number,
): Promise<ActivityPage> {
  const ws = access.workspaceId;
  const from = new Date(now.getTime() - ACTIVITY_WINDOW_MS);
  const rows = await activityRows(db, ws, from, before, PER_SOURCE);
  const after = horizon(rows, PER_SOURCE);
  const { page, next } = cut(runs(merge(rows, after), zone), size, after !== null);
  const lines = page.flatMap((r) => r.lines);
  const uids = lines.flatMap((r) =>
    r.kind === "followUp" ? [r.uid] : r.kind === "facts" ? r.uids : [],
  );
  const ids = lines.flatMap((r) => ("noticeId" in r ? [r.noticeId] : []));
  const reviewers = lines.flatMap((r) =>
    r.kind === "reviewAsked" && r.reviewerId !== null ? [r.reviewerId] : [],
  );
  const [officers, members, titles] = await Promise.all([
    officerNames(db, ws, [...new Set([...lines.map((r) => r.by), ...reviewers])]),
    memberNames(db, ws, access.unionId, [...new Set(uids)]),
    // A deleted notice keeps its last title here (D118): its earlier lines and its delete name it.
    noticeTitles(db, ws, [...new Set(ids)], true),
  ]);
  const names = { officers, members, titles };
  return {
    lines: page.flatMap((r): ActivityLine[] => {
      const item = itemOf(r.head, names);
      if (!item) return [];
      const run = r.lines.length > 1 ? r.lines.flatMap((l) => itemOf(l, names) ?? []) : [];
      return [{ item, run, n: new Set(r.lines.map(sameKey)).size }];
    }),
    next,
  };
}
