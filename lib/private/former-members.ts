// Former members (D107): uids an earlier roster of the workspace's own alliance listed and its newest
// roster does not, newest leavers first, with what officers recorded about them. Only the name, the
// public might and kills of the last roster that listed them, that roster's server day and the facts;
// never the map position, online status, join date, donations, activity or photo (CLAUDE.md, D71). They
// are not members any more, so nothing here feeds roll calls, suggestions, counts or the alliance's
// numbers. A member who comes back has the same uid, so the Members tab shows their facts again.
import type { Db } from "../db";
import { anyRoster } from "../repo/workspace-any-roster";
import { lastSeen } from "../repo/workspace-past-roster";
import { serverDay } from "../schedule";
import type { WorkspaceAccess } from "./access";
import type { MemberFacts } from "./fact-fields";
import { factsOf } from "./member-facts";

export interface FormerMember {
  uid: number;
  name: string;
  /** The server day of the last roster that listed them. */
  lastSeen: string;
  might: number | null;
  kills: number | null;
  facts: MemberFacts;
}

/** The workspace's former members, newest leavers first; `zone` is the server's (SERVER_TZ). */
export async function formerMembers(
  db: Db,
  access: WorkspaceAccess,
  zone: string,
): Promise<FormerMember[]> {
  const [roster, seen, facts] = await Promise.all([
    anyRoster(db, access.unionId),
    lastSeen(db, access.unionId),
    factsOf(db, access),
  ]);
  if (!roster) return [];
  const now = new Set(roster.members.map((m) => m.uid));
  return seen
    .filter((s) => !now.has(s.uid))
    .sort((a, b) => b.at.getTime() - a.at.getTime() || a.name.localeCompare(b.name))
    .map((s) => ({
      uid: s.uid,
      name: s.name,
      lastSeen: serverDay(s.at, { SERVER_TZ: zone }),
      might: s.power,
      kills: s.kills,
      facts: facts.get(s.uid) ?? {},
    }));
}
