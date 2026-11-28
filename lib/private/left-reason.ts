// Why a former member left (issue 469, D107 amendment 2026-11-27): an officer's choice of reason and an
// optional note, saved as the next version of the member fact `leftReason` (append-only, D80; a correction
// is a new version, D123). Only a former member of the workspace's own alliance (an earlier roster listed
// them, the newest does not) can have one. A save names the version the officer saw: when another officer
// saved since, it is refused with the newer reason (409), never combined. Also the monthly counts by reason
// on Former members: numbers only, never names.
import { z } from "zod";

import type { Db } from "../db";
import { factVersion, insertFact, type FactRow } from "../repo/member-facts";
import { wasInRoster } from "../repo/workspace-past-roster";
import type { WorkspaceAccess } from "./access";
import {
  LEFT_FIELD,
  LEFT_NOTE_MAX,
  LEFT_REASONS,
  type LeftReason,
  type LeftReasonCode,
} from "./fact-fields";
import type { FormerMember } from "./former-members";
import { isMember } from "./member-facts";

export const LEFT_CHANGE = z
  .object({
    /** The version the officer saw; 0 when none was saved. */
    version: z.number().int().min(0),
    reason: z.enum(LEFT_REASONS),
    note: z.string().trim().max(LEFT_NOTE_MAX),
  })
  .strict();
export type LeftChange = z.infer<typeof LEFT_CHANGE>;

export type LeftResult = {
  status: "saved" | "conflict";
  version: number;
  value: LeftReason | null;
};

const answer = (status: LeftResult["status"], row: FactRow): LeftResult => ({
  status,
  version: row.version,
  value: row.value as LeftReason | null,
});

/** Saves the reason; null when `uid` is not a former member of the workspace's alliance. */
export async function saveLeftReason(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  change: LeftChange,
  now: Date,
): Promise<LeftResult | null> {
  if ((await isMember(db, access, uid)) || !(await wasInRoster(db, access.unionId, uid)))
    return null;
  const where = [db, access.workspaceId, uid, LEFT_FIELD] as const;
  const newest = await factVersion(...where, "newest");
  const current = newest?.version ?? 0;
  const value: LeftReason = { reason: change.reason, note: change.note };
  if (newest && change.version !== current) {
    // Two officers saved the same thing: nothing to refuse.
    const same = JSON.stringify(newest.value) === JSON.stringify(value);
    return answer(same ? "saved" : "conflict", newest);
  }
  const row = { workspaceId: access.workspaceId, uid, field: LEFT_FIELD, version: current + 1 };
  const written = { value, source: "officer" as const, writtenBy: access.user.id, writtenAt: now };
  if (await insertFact(db, { ...row, ...written })) {
    return { status: "saved", version: current + 1, value };
  }
  // Another officer saved between the read and the write.
  return answer("conflict", (await factVersion(...where, "newest")) as FactRow);
}

export interface LeftMonth {
  /** "2026-11": the month of the server day they were last seen. */
  month: string;
  total: number;
  /** Every reason, in LEFT_REASONS order; no reason saved counts as Unknown. */
  counts: Record<LeftReasonCode, number>;
}

/** Former members by the month they were last seen, newest first, counted by reason. */
export function leftByMonth(former: readonly FormerMember[]): LeftMonth[] {
  const months = new Map<string, LeftMonth>();
  for (const m of former) {
    const month = m.lastSeen.slice(0, 7);
    const zero = Object.fromEntries(LEFT_REASONS.map((r) => [r, 0])) as LeftMonth["counts"];
    const row = months.get(month) ?? { month, total: 0, counts: zero };
    row.counts[m.facts.leftReason?.value?.reason ?? "unknown"] += 1;
    row.total += 1;
    months.set(month, row);
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}
