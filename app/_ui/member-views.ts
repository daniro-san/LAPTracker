// Both rosters of an alliance merged by uid for the member table (plan Phase 5c).
import { rosterDiff } from "@/lib/compute";
import type { MemberRow } from "@/lib/queries";

import type { MemberView } from "./MembersExplorer";

const stat = (m: MemberRow | undefined) =>
  m ? { power: m.power, kills: m.kills, lv: m.lv } : null;

/** Every member of either roster, matched by uid (§3.8): joined, left, or stayed (maybe renamed). */
export function memberViews(before: MemberRow[], after: MemberRow[]): MemberView[] {
  const diff = rosterDiff(before, after);
  return [
    ...diff.stayed.map(({ before: b, after: a }) => ({
      uid: a.uid,
      name: a.name,
      wasName: b.name !== a.name ? b.name : null,
      status: "" as const,
      before: stat(b),
      after: stat(a),
    })),
    ...diff.joined.map((a) => ({
      uid: a.uid,
      name: a.name,
      wasName: null,
      status: "joined" as const,
      before: null,
      after: stat(a),
    })),
    ...diff.left.map((b) => ({
      uid: b.uid,
      name: b.name,
      wasName: null,
      status: "left" as const,
      before: stat(b),
      after: null,
    })),
  ];
}
