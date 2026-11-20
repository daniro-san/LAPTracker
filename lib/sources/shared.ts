// Pieces both adapters share: the request headers, the timeout and the roster fields both APIs return.
import { z } from "zod";

import { sumKills } from "../compute";
import { type AllianceSnapshotInput, type Quota, SchemaError, type SchemaCode } from "./types";

// INVARIANT user-agent-always: without it Cloudflare answers 403 before the key is checked (plan §2).
export const USER_AGENT = "laptracker/1.0 (+https://github.com/daniro-san/LAPTracker)";

/** Player photos live on this host; anything else (the game's default heads are relative paths) is no photo. */
const PHOTO_HOST = "phs-image.globallap.com";

/** The game's avatar frames: `/static/frames/frame_<id>.png`, relative to the tracker site (D65). */
const FRAME_PATH = /^\/static\/frames\/frame_(\d{1,9})\.png$/;

/** The frame's id when the value is a frame file's path; else null. Only the id is stored (D65). */
export function frameId(raw: string | null | undefined): number | null {
  const id = raw ? FRAME_PATH.exec(raw)?.[1] : undefined;
  return id === undefined ? null : Number(id);
}

/** The URL when it is a real photo: plain https on PHOTO_HOST, no port or credentials; else null (D22). */
export function photoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const plain = url.protocol === "https:" && url.port === "" && !url.username && !url.password;
    return plain && url.hostname === PHOTO_HOST ? url.href : null;
  } catch {
    return null;
  }
}

/** A /v1 read may be a live pull from the game (~2 s measured). */
export const TIMEOUT_MS = 30_000;

/** Only the fields we read (plan Phase 2): a rename upstream fails here, not as silent zeros. */
const memberSchema = z.object({
  uid: z.number().int(),
  nick_name: z.string(),
  power: z.number().nullable(),
  kills: z.number().nullable(),
  lv: z.number().int().nullable(),
  // Absent or null: a photo is cosmetic, so a missing one never fails a run.
  avatar_url: z.string().nullish(),
  // The same rule: the frame around the photo is cosmetic (D65).
  frame_url: z.string().nullish(),
  // The same rule: the leadership marks are cosmetic. Since 2026-11-16 the upstream sends
  // `rank_code: null` and `rank_label: ""` for a member the game's roster did not list.
  rank_code: z.number().int().nullish(),
  rank_label: z.string().nullish(),
});

export const rosterFields = {
  union_id: z.number().int(),
  abbr: z.string(),
  name: z.string(),
  power: z.number(),
  member_count: z.number().int(),
  // Optional: the internal source does not send it, and a missing one never fails a run.
  capacity: z.number().int().nullable().optional(),
  level: z.number().int().nullable(),
  badge_id: z.number().int().nullable().optional(),
  rank: z.object({ rank: z.number().int() }).nullable(),
  updated_at: z.number().nullable(),
  members: z.array(memberSchema),
};

type Roster = z.infer<z.ZodObject<typeof rosterFields>>;

export function toSnapshotInput(
  roster: Roster,
  extra: { cached: boolean | null; quota: Quota | null; raw: unknown },
): AllianceSnapshotInput {
  // Issue 481: the tracker once listed 101 of 100, the extra one with an empty rank. A member sent with
  // `rank_code: null` and no `rank_label` is not one of the read's members; the body (`raw`) keeps them.
  const ranked = roster.members.filter((m) => !(m.rank_code === null && !m.rank_label));
  const members = ranked.map((m) => ({
    uid: m.uid,
    name: m.nick_name,
    power: m.power,
    kills: m.kills,
    lv: m.lv,
    avatarUrl: photoUrl(m.avatar_url),
    frameId: frameId(m.frame_url),
    rankCode: m.rank_code ?? null,
    rankLabel: m.rank_label ?? null,
  }));
  return {
    unionId: roster.union_id,
    tag: roster.abbr,
    name: roster.name,
    memberCount: roster.member_count - (roster.members.length - ranked.length),
    capacity: roster.capacity ?? null,
    totalPower: roster.power,
    // INVARIANT total-kills-is-roster-sum
    totalKills: sumKills(members),
    members,
    serverRank: roster.rank?.rank ?? null,
    level: roster.level,
    badgeId: roster.badge_id ?? null,
    sourceUpdatedAt: roster.updated_at === null ? null : new Date(roster.updated_at * 1000),
    listed: roster.members.length,
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
