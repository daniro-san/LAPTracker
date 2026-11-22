// Shared setup of the desk-activity tests (D108): a workspace with a two-member roster (Bramble 101,
// Thistle 102), signed-in browsers, and the feed's lines as plain text. Invented names only.
import type { Db } from "../db";
import { truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireBoard, requireWorkspace, type WorkspaceAccess } from "./access";
import { activityPage, type ActivityLine } from "./desk-activity";
import { feedLine } from "./desk-activity-words";
import { WORKSPACE_DICTIONARIES, type WorkspaceLanguage } from "./dictionary";
import { createSession } from "./session";

const OGS = 67111155;
export const NOW = new Date("2026-11-20T12:00:00Z");
export const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

/** A fresh database with the ogs workspace (with a member role) and one roster; returns its id. */
export async function freshWorkspace(db: Db): Promise<number> {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: OGS,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
    memberRoleIds: ["3"],
  });
  await db
    .insert(dailyReads)
    .values({ day: "2026-11-19", startedAt: ago(600), status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-19",
    unionId: OGS,
    memberCount: 2,
    sourceUpdatedAt: ago(600),
    isFresh: true,
    memberUids: [101, 102],
    memberNames: ["Bramble", "Thistle"],
    memberPower: [1000, 1000],
    memberKills: [0, 0],
    rawJson: { members: [] },
  });
  return (await findWorkspaceBySlug(db, "ogs"))?.id ?? 0;
}

/** A signed-in browser of `name`: its account, a desk request at `at`, and a board request at `at`. */
export async function browser(
  db: Db,
  ws: number,
  name: string,
  tier: "officer" | "member" = "officer",
) {
  const userId = await recordSignIn(db, ws, `ogs-${name}`, name, ago(120));
  const { token } = await createSession(db, ws, userId, ago(120), null, tier);
  const jar = { get: () => ({ value: token }) };
  const visit = async (at: Date): Promise<WorkspaceAccess | null> => {
    const access = await requireWorkspace(db, "ogs", jar, at);
    return access.ok ? access : null;
  };
  const board = async (at: Date) => (await requireBoard(db, "ogs", jar, at)).ok;
  return { userId, visit, board };
}

/** The feed's newest `size` lines at `now` (server time `zone`, UTC by default), as Home reads its first page. */
export const recentActivity = async (
  db: Db,
  access: WorkspaceAccess,
  now: Date,
  size = 40,
  zone = "UTC",
) => (await activityPage(db, access, { now, zone }, null, size)).lines;

/** The feed's lines in English (or `language`), without the isolation marks. */
export const linesOf = (lines: ActivityLine[], language: WorkspaceLanguage = "en") =>
  lines.map((l) => feedLine(l, WORKSPACE_DICTIONARIES[language], language).replace(/[⁨⁩]/g, ""));
