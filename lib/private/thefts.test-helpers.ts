// What the thefts log's PGlite tests share (issue 321): two workspaces (OGs, NSE), invented daily rosters of
// four tracked alliances, an officer's session, and a typed theft's input.
import { randomUUID } from "node:crypto";

import type { Db } from "../db";
import { truncateAll } from "../db.test-helpers";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { requireWorkspace, type WorkspaceAccess } from "./access";
import { createSession } from "./session";

export const OGS = 67111155;
export const NSE = 67109944;
export const URSA = 67110320;
/** A tracked alliance whose newest roster reads KLV, the invented tag report 54's text names. */
export const KLV = 67110584;
export const NOW = new Date("2026-11-16T12:00:00Z");
export const CLOCK = { now: NOW, zone: "Etc/GMT+2" };

/** One alliance's daily roster: uid → name (D60). */
async function roster(
  db: Db,
  unionId: number,
  tag: string,
  day: string,
  names: Record<number, string>,
) {
  const uids = Object.keys(names).map(Number);
  await db
    .insert(dailyReads)
    .values({ day, startedAt: NOW, status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag,
    memberCount: uids.length,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => names[u] ?? ""),
    memberPower: uids.map(() => 1000),
    memberKills: uids.map(() => 0),
  });
}

/** An empty database with the two workspaces and the rosters every thefts test reads. */
export async function seedThefts(db: Db): Promise<void> {
  await truncateAll(db);
  await saveWorkspace(db, { unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  await saveWorkspace(db, { unionId: NSE, slug: "nse", discordGuildId: "3", leaderRoleIds: ["4"] });
  await roster(db, OGS, "OGs", "2026-11-15", {
    11: "Wrenna",
    12: "HealerManor2451",
    13: "Grimbald",
  });
  await roster(db, NSE, "NSE", "2026-11-14", { 21: "Grimm", 22: "Gremlin" });
  await roster(db, NSE, "NSE", "2026-11-15", { 21: "Grimmer", 22: "Gremlin" });
  await roster(db, URSA, "URSA", "2026-11-15", { 31: "Agrim" });
  await roster(db, KLV, "KLV", "2026-11-15", { 41: "Zarpbunny" });
}

export async function signedIn(db: Db, slug: string): Promise<WorkspaceAccess> {
  const ws = await findWorkspaceBySlug(db, slug);
  const userId = await recordSignIn(db, ws?.id ?? 0, `officer-${slug}`, "Ana", NOW);
  const { token } = await createSession(db, ws?.id ?? 0, userId, NOW, null, "officer");
  const access = await requireWorkspace(db, slug, { get: () => ({ value: token }) }, NOW);
  if (!access.ok) throw new Error(`no access to ${slug}`);
  return access;
}

export const typed = (
  attacker: { uid: number } | { name: string; tag: string },
  victimUid: number,
) => ({
  attacker,
  victimUid,
  day: "2026-11-15",
  time: "13:46",
  kind: "caravan" as const,
  note: "",
  requestId: randomUUID(),
});
