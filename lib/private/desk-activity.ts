// Home's "On the desk now" and "Recent activity" (D108). Presence comes from officer sessions only (a
// member's session on the board never counts, the game's online flag is not used). The feed merges the
// newest actions of each history in memory: newest first, one line per action, the same action repeated
// by the same officer on the same thing shown once. People first (D75): no counts per officer, no list of
// who is away, and only what was worked on, never a member's values or a note.
import type { Db } from "../db";
import { officerNames } from "../repo/calendar";
import {
  activityRows,
  memberNames,
  officersSeen,
  type DraftDone,
  type EntryDone,
  type FollowUpDone,
  type MarksDone,
} from "../repo/desk-activity";
import type { ReviewAnsweredDone, ReviewAskedDone } from "../repo/desk-activity-reviews";
import { SAVED_DRAFT_KEEP_MS } from "../repo/import";
import { noticeTitles } from "../repo/notices";
import type { WorkspaceAccess } from "./access";

/** "On the desk now": a session seen in the last ten minutes. */
export const ON_DESK_MS = 10 * 60_000;
/** The feed looks back two weeks: as long as a saved draft's row is kept (D108). */
export const ACTIVITY_WINDOW_MS = SAVED_DRAFT_KEEP_MS;
/** The most lines the feed holds; Home shows the first ACTIVITY_SHOWN and the rest under "Show more". */
export const ACTIVITY_MAX = 40;
export const ACTIVITY_SHOWN = 6;

/** The other officers on the desk now, by name; the officer looking is left out. */
export function onDeskNow(db: Db, access: WorkspaceAccess, now: Date): Promise<string[]> {
  const since = new Date(now.getTime() - ON_DESK_MS);
  return officersSeen(db, access.workspaceId, access.user.id, since, now);
}

type What =
  /** `uids`: members saved one at a time; `batch`: members of batch saves (a sheet import). */
  | { kind: "facts"; uids: number[]; batch: number }
  | { kind: "noticeSaved" | "noticePosted" | "noticeDeleted"; noticeId: number }
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
          | "reviewAsked"
          | "reviewAnswered";
      }
    >
  | { kind: "facts"; member: string | null; members: number }
  | ({ kind: "followUp"; member: string | null } & Pick<FollowUpDone, "action" | "until">)
  | { kind: "noticeSaved" | "noticePosted" | "noticeDeleted"; title: string }
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

/** Two lines of the same noisy verb as one: member info saves, thefts added, new members added. */
function joined(a: Raw, b: Raw): Raw | null {
  if (a.kind === "facts" && b.kind === "facts") {
    return { ...a, uids: [...a.uids, ...b.uids], batch: a.batch + b.batch };
  }
  if (a.kind === "thefts" && b.kind === "thefts") return { ...a, count: a.count + b.count };
  if (a.kind === "newMember" && b.kind === "newMember") {
    return { ...a, names: [...a.names, ...b.names] };
  }
  return null;
}

/**
 * One officer's consecutive lines of a noisy verb become one line at the newest time ("Ana updated 9
 * members"), so a post, a roll call or a break stays in sight (persona panel, 2026-11-17).
 */
function grouped(lines: Raw[]): Raw[] {
  const out: Raw[] = [];
  for (const r of lines) {
    const last = out.at(-1);
    const both = last && last.by === r.by ? joined(last, r) : null;
    if (both) out[out.length - 1] = both;
    else out.push(r);
  }
  return out;
}

/** Every source's rows as feed lines, merged: newest first, covered and repeated lines dropped. */
function merge(rows: Awaited<ReturnType<typeof activityRows>>): Raw[] {
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
  const top = new Map<string, number>();
  for (const r of raw) top.set(instant(r), Math.max(top.get(instant(r)) ?? 0, rank(r)));
  const shown = raw
    .filter((r) => rank(r) >= (top.get(instant(r)) ?? 0))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  return grouped(shown.filter((r, i) => i === 0 || sameKey(r) !== sameKey(shown[i - 1] as Raw)));
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

/** The newest ACTIVITY_MAX things officers did in the last two weeks, with names resolved. */
export async function recentActivity(
  db: Db,
  access: WorkspaceAccess,
  now: Date,
): Promise<ActivityItem[]> {
  const ws = access.workspaceId;
  const from = new Date(now.getTime() - ACTIVITY_WINDOW_MS);
  const lines = merge(await activityRows(db, ws, from, ACTIVITY_MAX)).slice(0, ACTIVITY_MAX);
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
  return lines.flatMap((r): ActivityItem[] => {
    const who = officers.get(r.by);
    if (!who) return [];
    const line = r;
    if ("noticeId" in line) return [noticeItem(line, who, titles, officers)];
    switch (line.kind) {
      case "facts": {
        const one = new Set(line.uids);
        const [uid] = [...one];
        const member = one.size === 1 && line.batch === 0 ? (members.get(uid ?? 0) ?? null) : null;
        return [{ kind: "facts", at: line.at, who, member, members: one.size + line.batch }];
      }
      case "followUp": {
        const { at, action, until } = line;
        return [
          { kind: "followUp", at, action, until, who, member: members.get(line.uid) ?? null },
        ];
      }
      default:
        return [{ ...line, who }];
    }
  });
}
