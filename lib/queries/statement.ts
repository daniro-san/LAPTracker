// The alliance's statement and how to join (D128, issue 479): the text the alliance writes in game and its
// joining rules, from its newest daily read that kept the response (raw_json, D72). Only these fields leave
// raw_json, picked out in SQL: never `members`, `leader_id` or any roster key (D71).
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import type { Db } from "../db";
import { dailyRosters } from "../schema";

/** How to join, from one daily read's response; also the rows of /alliances' open seats (issue 792). */
export interface Joining {
  /** `join.auto`: true, anyone may join; false, by application; null when the read has no `join`. */
  open: boolean | null;
  /** `join.power`, the least might to join; null when there is none (0). */
  minMight: number | null;
  /** `join.castle_level`, the least HQ level to join; null when there is none (0). */
  minHq: number | null;
  members: number | null;
  capacity: number | null;
}

export interface AllianceStatement extends Joining {
  /** The server day of the read the card comes from (`2026-11-19`). */
  day: string;
  /** `declaration`, else `bulletin`, as written; null when both are empty. */
  text: string | null;
  /** `language` when it names a known language (`en`); null for `all` or an unknown code. */
  lang: string | null;
}

const raw = (path: string) =>
  sql<string | null>`${dailyRosters.rawJson} #>> ${`{${path}}`}::text[]`;

const languageNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });

/** Upstream text: a code Intl names (`en`, `de`), else null (`all`, a malformed code). */
function knownLanguage(code: string | null): string | null {
  if (!code) return null;
  try {
    return languageNames.of(code) ? code : null;
  } catch {
    return null;
  }
}

/** A whole number ≥ 0 from upstream text, else null. */
function count(value: string | null): number | null {
  const n = Number(value);
  return value !== null && value !== "" && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** The joining fields picked out of `raw_json` in SQL: never `members`, `leader_id` or a roster key. */
export const joiningColumns = {
  auto: raw("join,auto"),
  power: raw("join,power"),
  castle: raw("join,castle_level"),
  members: raw("member_count"),
  capacity: raw("capacity"),
};

type JoiningRaw = { [K in keyof typeof joiningColumns]: string | null };

/** The joining fields as numbers and a flag; a minimum of 0 means none. */
export function joiningOf(row: JoiningRaw): Joining {
  const members = count(row.members);
  const capacity = count(row.capacity);
  return {
    open: row.auto === null ? null : row.auto === "true",
    minMight: count(row.power) || null,
    minHq: count(row.castle) || null,
    // Issue 481: the tracker once sent 101 of 100; the card never shows more than the capacity.
    members: members !== null && capacity !== null ? Math.min(members, capacity) : members,
    capacity,
  };
}

/** The statement and joining rules of the newest daily read with a response; null when there is none.
 * A failed read keeps no response (D72), so the card falls back to the newest one that succeeded. */
export async function allianceStatement(
  db: Db,
  unionId: number,
): Promise<AllianceStatement | null> {
  const [row] = await db
    .select({
      day: dailyRosters.readDay,
      declaration: raw("declaration"),
      bulletin: raw("bulletin"),
      language: raw("language"),
      ...joiningColumns,
    })
    .from(dailyRosters)
    .where(
      and(
        eq(dailyRosters.unionId, unionId),
        isNull(dailyRosters.error),
        isNotNull(dailyRosters.rawJson),
      ),
    )
    .orderBy(desc(dailyRosters.readDay))
    .limit(1);
  if (!row) return null;
  const text = [row.declaration, row.bulletin].find((t) => t?.trim()) ?? null;
  return {
    day: row.day,
    text: text?.trim() ?? null,
    lang: knownLanguage(row.language),
    ...joiningOf(row),
  };
}
