// Former members (D107): uids an earlier roster of the workspace's own alliance listed and its newest
// roster does not, newest leavers first, with what officers recorded about them. Only the name, the
// public might and kills of the last roster that listed them, that roster's server day, the facts and
// the Alliance Duel points of the newest week saved for them (amendment 2026-11-17); never the map position, online status, join date, donations, activity or photo (CLAUDE.md, D71). They
// are not members any more, so nothing here feeds roll calls, suggestions, counts or the alliance's
// numbers. A member who comes back has the same uid, so the Members tab shows their facts again.
import type { Db } from "../db";
import { anyRoster } from "../repo/workspace-any-roster";
import { lastSeen, newestDuelWeeks } from "../repo/workspace-past-roster";
import { serverDay } from "../schedule";
import type { WorkspaceAccess } from "./access";
import type { MemberFacts } from "./fact-fields";
import type { DuelSaved } from "./import-view";
import { factsOf } from "./member-facts";

export interface FormerMember {
  uid: number;
  name: string;
  /** The server day of the last roster that listed them. */
  lastSeen: string;
  might: number | null;
  kills: number | null;
  facts: MemberFacts;
  /** The newest week of Alliance Duel points saved for them (its Monday), as the member card shows one. */
  duel: { week: string; points: DuelSaved } | null;
}

/**
 * The workspace's former members, newest leavers first; `zone` is the server's (SERVER_TZ). `known` is
 * the workspace's facts when the caller has read them already (the Members tab, from `membersView`).
 */
export async function formerMembers(
  db: Db,
  access: WorkspaceAccess,
  zone: string,
  known?: Map<number, MemberFacts>,
): Promise<FormerMember[]> {
  const [roster, seen, facts] = await Promise.all([
    anyRoster(db, access.unionId),
    lastSeen(db, access.unionId),
    known ?? factsOf(db, access),
  ]);
  if (!roster) return [];
  const now = new Set(roster.members.map((m) => m.uid));
  const gone = seen.filter((s) => !now.has(s.uid));
  const duel = new Map<number, { week: string; points: DuelSaved }>();
  for (const r of await newestDuelWeeks(
    db,
    access.workspaceId,
    gone.map((s) => s.uid),
  )) {
    const had = duel.get(r.uid)?.points;
    duel.set(r.uid, { week: r.week, points: { ...had, [r.day]: r.points } });
  }
  return gone
    .sort((a, b) => b.at.getTime() - a.at.getTime() || a.name.localeCompare(b.name))
    .map((s) => ({
      uid: s.uid,
      name: s.name,
      lastSeen: serverDay(s.at, { SERVER_TZ: zone }),
      might: s.power,
      kills: s.kills,
      facts: facts.get(s.uid) ?? {},
      duel: duel.get(s.uid) ?? null,
    }));
}
