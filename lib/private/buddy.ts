// A member's buddy (issue 828, D140 amendment 2026-11-28): an officer names a current member of the
// workspace's own alliance to say hello (the "buddy"), saved as the next version of the member fact `buddy`
// (append-only, D80); a clear is a version with no value. Only a current member can have a buddy, and the
// buddy is another current member (an officer is a member with a rank of R4 or R5). A save names the
// version the officer saw: when another officer saved since, it is refused with the newer buddy (409),
// never combined. The card and Follow-up show the buddy by name, only while they are still a member.
import { z } from "zod";

import type { Db } from "../db";
import { factVersion, insertFact, type FactRow } from "../repo/member-facts";
import type { WorkspaceAccess } from "./access";
import type { WorkspaceDictionary, WorkspaceKey } from "./dictionary";
import { BUDDY_FIELD, type MemberFacts } from "./fact-fields";
import { isMember } from "./member-facts";
import type { MemberRow } from "./members";

export const BUDDY_CHANGE = z
  .object({
    /** The version the officer saw; 0 when none was saved. */
    version: z.number().int().min(0),
    /** A member's game uid; null clears the buddy (Undo). */
    buddy: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).nullable(),
  })
  .strict();
export type BuddyChange = z.infer<typeof BUDDY_CHANGE>;

export type BuddyResult = { status: "saved" | "conflict"; version: number; value: number | null };

const answer = (status: BuddyResult["status"], row: FactRow): BuddyResult => ({
  status,
  version: row.version,
  value: row.value as number | null,
});

const CARD_KEYS = [
  "card.buddy.line",
  "card.buddy.add",
  "card.buddy.change",
  "card.buddy.pick",
  "card.buddy.officers",
  "card.buddy.members",
  "card.buddy.save",
  "card.buddy.undo",
  "card.buddy.saved",
  "card.buddy.undone",
  "card.buddy.failed",
  "card.buddy.changed",
] as const satisfies readonly WorkspaceKey[];

/** The card's buddy block: the buddy now, the version for the save, who can be picked and the words. */
export interface CardBuddy {
  name: string | null;
  version: number;
  /** The other current members, officers (R4, R5) first, each group by name. */
  options: { uid: number; name: string; officer: boolean }[];
  words: Pick<WorkspaceDictionary, (typeof CARD_KEYS)[number]>;
}

const OFFICER_RANK = 104;

export function cardBuddy(
  member: MemberRow,
  members: readonly MemberRow[],
  t: WorkspaceDictionary,
): CardBuddy {
  const options = members
    .filter((m) => m.uid !== member.uid)
    .map((m) => ({ uid: m.uid, name: m.name, officer: (m.rankCode ?? 0) >= OFFICER_RANK }))
    .sort((a, b) => Number(b.officer) - Number(a.officer) || a.name.localeCompare(b.name));
  return {
    name: member.buddy?.name ?? null,
    version: member.facts.buddy?.version ?? 0,
    options,
    words: Object.fromEntries(CARD_KEYS.map((k) => [k, t[k]])) as CardBuddy["words"],
  };
}

/** The member's buddy as the card and Follow-up show them: by name, while they are in the alliance. */
export function buddyOf(
  facts: MemberFacts,
  uid: number,
  names: ReadonlyMap<number, string>,
): { uid: number; name: string } | null {
  const buddy = facts.buddy?.value;
  const name = typeof buddy === "number" && buddy !== uid ? names.get(buddy) : undefined;
  return name === undefined ? null : { uid: buddy as number, name };
}

/** Whether `buddy` may be named for `uid`: nobody (a clear), or another member of the alliance. */
const mayName = async (db: Db, access: WorkspaceAccess, uid: number, buddy: number | null) =>
  buddy === null || (buddy !== uid && (await isMember(db, access, buddy)));

/**
 * Saves the buddy of `uid`. Null when `uid` is not a member of the workspace's own alliance; "invalid"
 * when the buddy is not another one (D71).
 */
export async function saveBuddy(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  change: BuddyChange,
  now: Date,
): Promise<BuddyResult | "invalid" | null> {
  if (!(await isMember(db, access, uid))) return null;
  if (!(await mayName(db, access, uid, change.buddy))) return "invalid";
  const where = [db, access.workspaceId, uid, BUDDY_FIELD] as const;
  const newest = await factVersion(...where, "newest");
  const current = newest?.version ?? 0;
  if (newest && change.version !== current)
    return answer(newest.value === change.buddy ? "saved" : "conflict", newest);
  // Nothing was ever saved and nothing is asked: no version to add.
  if (!newest && change.buddy === null) return { status: "saved", version: 0, value: null };
  const row = { workspaceId: access.workspaceId, uid, field: BUDDY_FIELD, version: current + 1 };
  const written = {
    value: change.buddy,
    source: "officer" as const,
    writtenBy: access.user.id,
    writtenAt: now,
  };
  if (await insertFact(db, { ...row, ...written })) {
    return { status: "saved", version: current + 1, value: change.buddy };
  }
  // Another officer saved between the read and the write.
  return answer("conflict", (await factVersion(...where, "newest")) as FactRow);
}
