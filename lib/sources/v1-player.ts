// GET /v1/players/{uid}: the squads the tracker has seen (D117, spike #409) and, since D132, the rest of
// the read: the facts kept as columns, the `history[]` rows, and the body less `alliance_members` (whose
// private fields D71 governs, and which the daily roster already has). The fields are not in the API
// docs, so the squads keep D117's strict schema and every other field is read leniently: a field that
// changes type becomes null and never fails the squads read. Nothing of the body is logged.
import { z } from "zod";

import type { HistoryInput, PlayerFacts, PlayerSquadsInput } from "./types";

const num = z.number().nullish();
/** A field outside the squads: null when absent or of another type. */
const loose = <T extends z.ZodType>(t: T) =>
  t
    .nullish()
    .catch(null)
    .transform((v) => v ?? null);
const time = z.union([z.number(), z.string()]);

const heroSchema = z.object({
  id: z.number().int(),
  lv: num,
  star: num,
  q: num,
  awaken: num,
  honor: loose(z.number()),
});

const troopSchema = z.object({ id: z.number().int(), tier: num, n: num });

const squadSchema = z.object({
  squad: z.number().int(),
  power: z.number(),
  soldiers: num,
  soldier_load: num,
  // Not documented: epoch seconds (as `updated_at`), milliseconds or an ISO string are all read.
  seen_at: time.nullish(),
  heroes: z.array(heroSchema).nullish(),
  troops: loose(z.array(troopSchema)),
});

/** One `history[]` row (measured 2026-11-19: 40 rows a read, `observed_at` in epoch seconds). */
const historySchema = z.object({
  observed_at: time,
  power: loose(z.number()),
  kills: loose(z.number()),
  level: loose(z.number()),
  vip: loose(z.number()),
  union_id: loose(z.number()),
  union_abbr: loose(z.string()),
  sid: loose(z.number()),
  change_flags: loose(z.string()),
  nick: loose(z.string()),
});

export const playerSchema = z.object({
  uid: z.number().int(),
  // Absent or null: the tracker has seen no squad of this player yet.
  squads: z.array(squadSchema).nullish(),
  // The quota after this call, as every /v1 body sends it: the squads read's guard reads it (D117).
  quota: z
    .object({ limit: z.number().int(), used: z.number().int(), remaining: z.number().int() })
    .nullish(),
  shielding: loose(z.number()),
  shield_type: loose(z.number()),
  map_updated_at: loose(time),
  last_seen_at: loose(time),
  language: loose(z.string()),
  power: loose(z.number()),
  kills: loose(z.number()),
  union_id: loose(z.number()),
  sid: loose(z.number()),
  home_sid: loose(z.number()),
  vip: loose(z.number()),
  // Each row checked alone below: one odd row is dropped, not the read.
  history: loose(z.array(z.unknown())),
  alliance: loose(z.object({ updated_at: time })),
  // Only the uids: the rest of each member (D71's private fields among them) is never parsed.
  alliance_members: loose(z.array(z.object({ uid: z.number().int() }))),
});

/** Epoch seconds (an all-digit string too), milliseconds or an ISO string; null when unreadable. */
function timeOf(v: number | string | null | undefined): Date | null {
  if (v === null || v === undefined) return null;
  // Measured 2026-11-18 (100 members): always an integer in epoch seconds. An all-digit string is read
  // as that number.
  const n = typeof v === "number" ? v : /^\d+(\.\d+)?$/.test(v) ? Number(v) : null;
  const at = n !== null ? new Date(Math.round(n < 1e12 ? n * 1000 : n)) : new Date(v);
  return Number.isNaN(at.getTime()) ? null : at;
}

type Player = z.infer<typeof playerSchema>;

const factsOf = (d: Player): PlayerFacts => ({
  shielding: d.shielding,
  shieldType: d.shield_type,
  mapUpdatedAt: timeOf(d.map_updated_at),
  lastSeenAt: timeOf(d.last_seen_at),
  language: d.language,
  power: d.power,
  kills: d.kills,
  unionId: d.union_id,
  sid: d.sid,
  homeSid: d.home_sid,
  vip: d.vip,
});

function historyOf(rows: readonly unknown[]): HistoryInput[] {
  return rows.flatMap((row) => {
    const r = historySchema.safeParse(row);
    const t = r.success ? timeOf(r.data.observed_at) : null;
    if (!r.success || !t) return [];
    const h = r.data;
    return [
      {
        t,
        power: h.power,
        kills: h.kills,
        level: h.level,
        vip: h.vip,
        unionId: h.union_id,
        unionAbbr: h.union_abbr,
        sid: h.sid,
        changeFlags: h.change_flags,
        nick: h.nick,
      },
    ];
  });
}

function rosterOf(d: Player): PlayerSquadsInput["roster"] {
  const updatedAt = timeOf(d.alliance?.updated_at);
  if (d.union_id === null || !updatedAt || !d.alliance_members) return null;
  return { unionId: d.union_id, updatedAt, uids: d.alliance_members.map((m) => m.uid) };
}

/** The body as kept in `player_reads.raw_json`: everything but `alliance_members` (D132). */
function rawOf(body: unknown): Record<string, unknown> {
  const { alliance_members, ...rest } = body as Record<string, unknown>;
  void alliance_members;
  return rest;
}

export function toPlayerSquads(data: Player, body: unknown): PlayerSquadsInput {
  return {
    uid: data.uid,
    squads: (data.squads ?? []).map((s) => ({
      squad: s.squad,
      power: s.power,
      soldiers: s.soldiers ?? null,
      soldierLoad: s.soldier_load ?? null,
      seenAt: timeOf(s.seen_at),
      heroes: (s.heroes ?? []).map((h) => ({
        id: h.id,
        lv: h.lv ?? null,
        star: h.star ?? null,
        q: h.q ?? null,
        awaken: h.awaken ?? null,
        honor: h.honor,
      })),
      troops: (s.troops ?? []).map((t) => ({ id: t.id, tier: t.tier ?? null, n: t.n ?? null })),
    })),
    quota: data.quota ?? null,
    facts: factsOf(data),
    history: historyOf(data.history ?? []),
    raw: rawOf(body),
    roster: rosterOf(data),
  };
}
