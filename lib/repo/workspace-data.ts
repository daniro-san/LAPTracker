// Everything a workspace owns (D125), in one list: what "Download our data" reads and what the daily job
// deletes. A table with a `workspace_id` column must be listed here (workspace-data.test.ts checks every
// table of the schema), so a table added later is neither left out of the download nor left behind.
// Reads are generic: every column, in the database's names, less the ones never downloaded.
import { and, asc, desc, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import { getTableConfig, type PgColumn, type PgTable } from "drizzle-orm/pg-core";

import type { Db } from "../db";
import { BLOCKED_ROSTER_KEYS } from "../queries/blocked-keys";
import {
  calendarEntries,
  calendarOccurrences,
  garrisonPlans,
  kvkPlans,
  memberFacts,
  memberSelfReports,
  memberFollowUps,
  nameAliases,
  pendingMembers,
  rollCallMarks,
  rollCalls,
  rollCallTeam,
  workspaceSessions,
  workspaceUsers,
} from "../schema";
import { startHere, thanksShares, thanksTakedowns } from "../schema-board";
import {
  postRuns,
  workspaceDiscord,
  workspacePosts,
  workspacePostTouches,
  workspaceWebhooks,
} from "../schema-discord";
import { workspaceFeatures, workspaceUsage } from "../schema-features";
import { feedback, feedbackPictures } from "../schema-feedback";
import {
  allianceDuelPoints,
  discordPictures,
  screenshotChecks,
  screenshotDrafts,
} from "../schema-import";
import { workspaceKeyChanges, workspaceKeys } from "../schema-keys";
import {
  noticeEdits,
  noticePictures,
  noticePublishes,
  noticeReviewOutcomes,
  noticeReviews,
  notices,
} from "../schema-notices";
import { pushMarks, pushSubscriptions } from "../schema-push";
import { workspaceDataEvents, type DataAction } from "../schema-retention";
import { shieldChecks, shieldQueue, shieldSettings } from "../schema-shield";
import { memberSquads, playerHistory, playerReads, squadQueue, squadReads } from "../schema-squads";
import { theftAttackers, theftFollowUps, thefts } from "../schema-thefts";

/**
 * How a table's rows belong to a workspace: its own `workspace_id`, its roll call's or its thanks share's,
 * or the workspace's alliance (`union_id`: the squads read on the workspace's key, D117, D124).
 */
type Scope = "workspace" | "rollCall" | "thanksShare" | "union";

export interface WorkspaceTable {
  /** The CSV's name, without ".csv"; null: deleted but never downloaded. */
  file: string | null;
  table: PgTable;
  scope: Scope;
  /** Columns never downloaded, by their database names. */
  omit?: readonly string[];
}

/**
 * In the download's order. Never downloaded: sessions (token hashes), the sealed tracker key (D124) and
 * webhooks (D129),
 * Discord's message ids of pictures already read (D100) and the squads reads' counts. People leave out
 * their Discord id and What's new's seen version; a notice picture's bytes go as files, not in a cell.
 */
export const WORKSPACE_TABLES: readonly WorkspaceTable[] = [
  {
    file: "people",
    table: workspaceUsers,
    scope: "workspace",
    // Issue 782: What's new's seen version is the officer's own screen state, not alliance data.
    omit: ["discord_user_id", "allowlist_added_by", "whats_new_seen"],
  },
  { file: "member-facts", table: memberFacts, scope: "workspace" },
  // D154: what members sent about themselves; a fact only once an officer put it on the card.
  {
    file: "member-self-reports",
    table: memberSelfReports,
    scope: "workspace",
    omit: ["request_id"],
  },
  { file: "new-members", table: pendingMembers, scope: "workspace" },
  { file: "name-aliases", table: nameAliases, scope: "workspace" },
  { file: "calendar-entries", table: calendarEntries, scope: "workspace" },
  { file: "calendar-weeks", table: calendarOccurrences, scope: "workspace" },
  { file: "garrison-plans", table: garrisonPlans, scope: "workspace" },
  { file: "kvk-plans", table: kvkPlans, scope: "workspace" },
  { file: "notices", table: notices, scope: "workspace" },
  { file: "notice-texts", table: noticeEdits, scope: "workspace" },
  { file: "notice-posts", table: noticePublishes, scope: "workspace" },
  { file: "notice-reviews", table: noticeReviews, scope: "workspace" },
  { file: "notice-review-outcomes", table: noticeReviewOutcomes, scope: "workspace" },
  { file: "notice-pictures", table: noticePictures, scope: "workspace", omit: ["data"] },
  { file: "roll-calls", table: rollCalls, scope: "workspace" },
  { file: "roll-call-marks", table: rollCallMarks, scope: "rollCall" },
  { file: "roll-call-teams", table: rollCallTeam, scope: "rollCall" },
  { file: "follow-ups", table: memberFollowUps, scope: "workspace" },
  { file: "thefts", table: thefts, scope: "workspace" },
  { file: "theft-steps", table: theftFollowUps, scope: "workspace" },
  { file: "theft-attackers", table: theftAttackers, scope: "workspace" },
  { file: "thanks", table: thanksShares, scope: "workspace" },
  { file: "thanks-taken-down", table: thanksTakedowns, scope: "thanksShare" },
  { file: "start-here", table: startHere, scope: "workspace" },
  // D156: the alliance's own line on each of our posts, the officers' words like Start here.
  { file: "post-callouts", table: workspacePostTouches, scope: "workspace" },
  // D159: the alliance's settings of each catalog post (switch, channel, its own title, language).
  { file: "posts", table: workspacePosts, scope: "workspace" },
  { file: "screenshot-drafts", table: screenshotDrafts, scope: "workspace" },
  { file: "alliance-duel-points", table: allianceDuelPoints, scope: "workspace" },
  { file: "screenshot-checks", table: screenshotChecks, scope: "workspace" },
  { file: "squads", table: memberSquads, scope: "union" },
  // D132: every tracker read of a member as its columns, and the history rows. The raw bodies stay out:
  // about 90 days of them would pass the download's 4.4 MB, and they hold private fields (D71).
  { file: "player-reads", table: playerReads, scope: "union", omit: ["raw_json"] },
  { file: "player-history", table: playerHistory, scope: "union" },
  { file: "tracker-key-changes", table: workspaceKeyChanges, scope: "workspace" },
  { file: "data-requests", table: workspaceDataEvents, scope: "workspace" },
  { file: null, table: workspaceSessions, scope: "workspace" },
  { file: null, table: workspaceKeys, scope: "workspace" },
  // D129: the sealed webhooks, like the key, and the bot's and commands' state in the server.
  { file: null, table: workspaceWebhooks, scope: "workspace" },
  { file: null, table: workspaceDiscord, scope: "workspace" },
  // D126: the owner's switches and the daily counts are the owner's settings, not the alliance's data.
  { file: null, table: workspaceFeatures, scope: "workspace" },
  { file: null, table: workspaceUsage, scope: "workspace" },
  { file: null, table: discordPictures, scope: "workspace" },
  { file: null, table: squadReads, scope: "union" },
  { file: null, table: squadQueue, scope: "union" },
  // D137: the Raid Shield check's settings, its reads' state and the morning queue: counts and codes, as
  // the squads read's rows; the shield facts themselves are in player-reads.csv.
  { file: null, table: shieldSettings, scope: "workspace" },
  { file: null, table: shieldChecks, scope: "union" },
  { file: null, table: shieldQueue, scope: "union" },
  // D148: officers' devices for notifications, sealed like the webhooks, and what each trigger last sent.
  { file: null, table: pushSubscriptions, scope: "workspace" },
  { file: null, table: pushMarks, scope: "workspace" },
  // D159: each catalog post's claim per period: codes and counts, like the push marks.
  { file: null, table: postRuns, scope: "workspace" },
  // D157: what officers and members sent the site's owner; it is for the owner, so never downloaded.
  { file: null, table: feedback, scope: "workspace" },
  { file: null, table: feedbackPictures, scope: "workspace" },
];

/** Never downloaded from any table, whatever the list says (CLAUDE.md, D71, D22). */
const NEVER = new Set<string>([...BLOCKED_ROSTER_KEYS, "avatar_url"]);

const columnsOf = (table: PgTable) => getTableColumns(table) as Record<string, PgColumn>;

/** The rows of `t` that belong to the workspace. */
export function ownedBy(t: WorkspaceTable, ws: { id: number; unionId: number }): SQL {
  const c = columnsOf(t.table);
  const pick = (key: string) => c[key] as PgColumn;
  switch (t.scope) {
    case "workspace":
      return eq(pick("workspaceId"), ws.id);
    case "rollCall":
      return sql`${pick("rollCallId")} in (select id from roll_calls where workspace_id = ${ws.id})`;
    case "thanksShare":
      return sql`${pick("shareId")} in (select id from thanks_shares where workspace_id = ${ws.id})`;
    case "union":
      return eq(pick("unionId"), ws.unionId);
  }
}

/** One table as downloaded: its columns' database names, the officer columns among them, and its rows. */
export interface TableDump {
  file: string;
  columns: string[];
  /** Columns that hold a workspace user's id (who wrote, deleted, saved…), shown as a name. */
  officerColumns: string[];
  /** When the table keeps deleted records (D118, D120, D123): its delete time's column (`deleted_at`, or
   * `dismissed_at` for new members). */
  deletedColumn: string | null;
  rows: unknown[][];
}

/** The database names of the columns that point at a workspace user. */
function officerColumns(table: PgTable): Set<string> {
  const names = getTableConfig(table).foreignKeys.flatMap((fk) => {
    const ref = fk.reference();
    return ref.foreignTable === workspaceUsers ? ref.columns.map((col) => col.name) : [];
  });
  return new Set(names);
}

/** Every downloadable table of the workspace, every row, ordered by the table's first column. */
export async function workspaceDumps(
  db: Db,
  ws: { id: number; unionId: number },
): Promise<TableDump[]> {
  const listed = WORKSPACE_TABLES.flatMap((t) => (t.file === null ? [] : [{ ...t, file: t.file }]));
  return Promise.all(
    listed.map(async (t) => {
      const omit = new Set(t.omit ?? []);
      const kept = Object.entries(columnsOf(t.table)).filter(
        ([, col]) => !omit.has(col.name) && !NEVER.has(col.name),
      );
      const first = kept[0]?.[1] as PgColumn;
      // Only the columns downloaded: a notice picture's bytes are never read here (review of PR 449).
      const rows = (await db
        .select(Object.fromEntries(kept))
        .from(t.table)
        .where(ownedBy(t, ws))
        .orderBy(asc(first))) as Record<string, unknown>[];
      const officers = officerColumns(t.table);
      const columns = kept.map(([, col]) => col.name);
      return {
        file: t.file,
        columns,
        officerColumns: columns.filter((name) => officers.has(name)),
        deletedColumn: kept.find(([key]) => key === "deletedAt")?.[1].name ?? null,
        rows: rows.map((row) => kept.map(([key]) => row[key] ?? null)),
      };
    }),
  );
}

/**
 * The notices' pictures without their bytes: newest first, so the newest fit when the download is near its
 * limit, with each one's size in the database (`octet_length`), checked before its bytes are read.
 */
export async function noticePictureList(db: Db, workspaceId: number) {
  return db
    .select({
      noticeId: noticePictures.noticeId,
      type: noticePictures.type,
      size: sql<number>`octet_length(${noticePictures.data})`.mapWith(Number),
    })
    .from(noticePictures)
    .where(eq(noticePictures.workspaceId, workspaceId))
    .orderBy(desc(noticePictures.addedAt), asc(noticePictures.noticeId));
}

/** One notice picture's bytes, read only once it is known to fit. */
export async function noticePictureBytes(
  db: Db,
  workspaceId: number,
  noticeId: number,
): Promise<Uint8Array | null> {
  const [row] = await db
    .select({ data: noticePictures.data })
    .from(noticePictures)
    .where(and(eq(noticePictures.workspaceId, workspaceId), eq(noticePictures.noticeId, noticeId)));
  return row?.data ?? null;
}

/** Every workspace user's name (chosen, else Discord's), for the officer columns. */
export async function peopleNames(db: Db, workspaceId: number): Promise<Map<number, string>> {
  const rows = await db
    .select({
      id: workspaceUsers.id,
      name: sql<
        string | null
      >`coalesce(${workspaceUsers.chosenName}, ${workspaceUsers.displayName})`,
    })
    .from(workspaceUsers)
    .where(eq(workspaceUsers.workspaceId, workspaceId));
  return new Map(rows.flatMap((r) => (r.name ? [[r.id, r.name] as const] : [])));
}

/** The names of new members added by hand, under their uid in member facts (`-id`, D106). */
export async function newMemberNames(db: Db, workspaceId: number): Promise<Map<number, string>> {
  const rows = await db
    .select({ id: pendingMembers.id, name: pendingMembers.name })
    .from(pendingMembers)
    .where(eq(pendingMembers.workspaceId, workspaceId));
  return new Map(rows.map((r) => [-r.id, r.name]));
}

/**
 * Claims a download, a deletion asked or cancelled under its request id (D100); false when that request
 * was already recorded. `by` null: the site's owner.
 */
export async function claimDataEvent(
  db: Db,
  e: { workspaceId: number; action: DataAction; by: number | null; at: Date; requestId: string },
): Promise<boolean> {
  const rows = await db
    .insert(workspaceDataEvents)
    .values(e)
    .onConflictDoNothing()
    .returning({ id: workspaceDataEvents.id });
  return rows.length > 0;
}

/** Frees a request id whose action did not go through (a refused download, nothing to cancel). */
export async function dropDataEvent(db: Db, workspaceId: number, requestId: string) {
  await db
    .delete(workspaceDataEvents)
    .where(
      and(
        eq(workspaceDataEvents.workspaceId, workspaceId),
        eq(workspaceDataEvents.requestId, requestId),
      ),
    );
}
