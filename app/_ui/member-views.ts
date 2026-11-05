// Both rosters of an alliance merged by uid for the member table (plan Phase 5c), with each member's
// ledger rank by might inside the alliance in each roster (Phase 5e).
import { rankBy, rosterDiff } from "@/lib/compute";
import type { MemberRow } from "@/lib/queries";

import type { MemberView } from "./MembersExplorer";

const stat = (m: MemberRow | undefined) =>
  m ? { power: m.power, kills: m.kills, lv: m.lv } : null;

const mightRanks = (roster: MemberRow[]) => rankBy(roster.map((m) => [m.uid, m.power] as const));

/** Every member of either roster, matched by uid (§3.8): joined, left, or stayed (maybe renamed). */
export function memberViews(before: MemberRow[], after: MemberRow[]): MemberView[] {
  const diff = rosterDiff(before, after);
  const [rankBefore, rankAfter] = [mightRanks(before), mightRanks(after)];
  const rank = (uid: number) => ({
    before: rankBefore.get(uid) ?? null,
    after: rankAfter.get(uid) ?? null,
  });
  return [
    ...diff.stayed.map(({ before: b, after: a }) => ({
      uid: a.uid,
      name: a.name,
      hasAvatar: a.hasAvatar,
      wasName: b.name !== a.name ? b.name : null,
      status: "" as const,
      before: stat(b),
      after: stat(a),
      rank: rank(a.uid),
    })),
    ...diff.joined.map((a) => ({
      uid: a.uid,
      name: a.name,
      hasAvatar: a.hasAvatar,
      wasName: null,
      status: "joined" as const,
      before: null,
      after: stat(a),
      rank: rank(a.uid),
    })),
    ...diff.left.map((b) => ({
      uid: b.uid,
      name: b.name,
      hasAvatar: b.hasAvatar,
      wasName: null,
      status: "left" as const,
      before: stat(b),
      after: null,
      rank: rank(b.uid),
    })),
  ];
}
