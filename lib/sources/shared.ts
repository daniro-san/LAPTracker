// Pieces both adapters share: the request headers, the timeout and the roster fields both APIs return.
import { z } from "zod";

import { sumKills } from "../compute";
import { type AllianceSnapshotInput, type Quota, SchemaError, type SchemaCode } from "./types";

// INVARIANT user-agent-always: without it Cloudflare answers 403 before the key is checked (plan §2).
export const USER_AGENT = "laptracker/1.0 (+https://github.com/daniro-san/LAPTracker)";

/** A /v1 read may be a live pull from the game (~2 s measured). */
export const TIMEOUT_MS = 30_000;

/** Only the fields we read (plan Phase 2): a rename upstream fails here, not as silent zeros. */
const memberSchema = z.object({
  uid: z.number().int(),
  nick_name: z.string(),
  power: z.number().nullable(),
  kills: z.number().nullable(),
  lv: z.number().int().nullable(),
});

export const rosterFields = {
  union_id: z.number().int(),
  abbr: z.string(),
  name: z.string(),
  power: z.number(),
  member_count: z.number().int(),
  level: z.number().int().nullable(),
  rank: z.object({ rank: z.number().int() }).nullable(),
  updated_at: z.number().nullable(),
  members: z.array(memberSchema),
};

type Roster = z.infer<z.ZodObject<typeof rosterFields>>;

export function toSnapshotInput(
  roster: Roster,
  extra: { cached: boolean | null; quota: Quota | null; raw: unknown },
): AllianceSnapshotInput {
  const members = roster.members.map((m) => ({
    uid: m.uid,
    name: m.nick_name,
    power: m.power,
    kills: m.kills,
    lv: m.lv,
  }));
  return {
    unionId: roster.union_id,
    tag: roster.abbr,
    name: roster.name,
    memberCount: roster.member_count,
    totalPower: roster.power,
    // INVARIANT total-kills-is-roster-sum
    totalKills: sumKills(members),
    members,
    serverRank: roster.rank?.rank ?? null,
    level: roster.level,
    sourceUpdatedAt: roster.updated_at === null ? null : new Date(roster.updated_at * 1000),
    ...extra,
  };
}

/**
 * Parse a response body against `schema`. Returns the parsed fields and the whole body (`raw`).
 * On failure only issue paths leave, never values.
 */
export async function readBody<T extends z.ZodType>(
  response: Response,
  schema: T,
  code: SchemaCode,
): Promise<{ data: z.infer<T>; raw: unknown }> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new SchemaError(code, ["(body is not JSON)"]);
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new SchemaError(
      code,
      result.error.issues.map((i) => i.path.join(".") || "(root)"),
    );
  }
  return { data: result.data, raw: body };
}
