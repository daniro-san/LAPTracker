// For UI tests of the members' board (app/(private)/_ui, which may not read lib/repo): the OGs workspace with
// a member role, an officer's WorkspaceAccess and a member's BoardAccess.
import type { Db } from "../db";
import { findWorkspaceBySlug, recordSignIn, saveWorkspace } from "../repo/workspaces";
import { requireBoard, requireWorkspace } from "./access";
import { createSession } from "./session";

export async function boardWorkspace(db: Db, now: Date) {
  await saveWorkspace(db, {
    unionId: 67111155,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
    memberRoleIds: ["3"],
  });
  const ws = await findWorkspaceBySlug(db, "ogs");
  const cookie = async (name: string, tier: "officer" | "member") => {
    const userId = await recordSignIn(db, ws?.id ?? 0, `id-${name}`, name, now);
    const { token } = await createSession(db, ws?.id ?? 0, userId, now, null, tier);
    return { get: () => ({ value: token }) };
  };
  const officer = await requireWorkspace(db, "ogs", await cookie("Ana", "officer"), now);
  const member = await requireBoard(db, "ogs", await cookie("Rio", "member"), now);
  if (!officer.ok || !member.ok) throw new Error("no access");
  return { officer, member };
}
