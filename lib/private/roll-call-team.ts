// Elixir Scramble teams (issue 298, D103): up to TEAM_MAX players per team, and a member on one team of a
// workspace's week only. Changes to a week's teams run one at a time under one lock per workspace and week,
// so two officers adding the same member to Team A and Team B at once cannot both win. Only members of the
// workspace's own alliance (D71) are picked.
import type { Db } from "../db";
import { addToTeam, lockWeek, otherTeams, removeFromTeam, teamsOf } from "../repo/roll-call";
import type { WorkspaceAccess } from "./access";
import { ensureCall, openOccasion, rosterOf, type Occasion } from "./roll-call";
import { TEAM_MAX } from "./roll-call-rules";

export type TeamResult =
  | { ok: true; added: number[]; count: number }
  | { ok: false; code: "not_found" | "not_member" | "full" | "other_team" };

/** Picks members for an Elixir Scramble team, in order, or takes them off (`on` false). */
export async function setTeam(
  db: Db,
  access: WorkspaceAccess,
  input: { occasion: Occasion; uids: number[]; on: boolean },
  now: Date,
): Promise<TeamResult> {
  const uids = [...new Set(input.uids)];
  const o = await openOccasion(db, access, input.occasion);
  if (!o?.placed || o.kind !== "elixir") return { ok: false, code: "not_found" };
  const roster = new Map((await rosterOf(db, access)).map((m) => [m.uid, m.name]));
  if (input.on && uids.some((uid) => !roster.has(uid))) return { ok: false, code: "not_member" };
  const call = await ensureCall(db, access, o);
  return db.transaction(async (tx) => {
    // INVARIANT roll-call.one-team-a-week: the other teams are read under the week's lock.
    await lockWeek(tx, call.workspaceId, call.week);
    const team = new Set((await teamsOf(tx, [call.id])).map((m) => m.uid));
    if (!input.on) {
      await removeFromTeam(tx, call.id, uids);
      return { ok: true, added: [], count: [...team].filter((u) => !uids.includes(u)).length };
    }
    const elsewhere = new Set((await otherTeams(tx, call)).map((m) => m.uid));
    const fresh = uids.filter((uid) => !team.has(uid));
    const free = fresh.filter((uid) => !elsewhere.has(uid));
    if (fresh.length > 0 && free.length === 0) return { ok: false, code: "other_team" };
    if (free.length > 0 && team.size >= TEAM_MAX) return { ok: false, code: "full" };
    const added = free.slice(0, TEAM_MAX - team.size);
    await addToTeam(
      tx,
      added.map((uid) => ({
        rollCallId: call.id,
        uid,
        name: roster.get(uid) ?? "",
        addedBy: access.user.id,
        addedAt: now,
      })),
    );
    return { ok: true, added, count: team.size + added.length };
  });
}
