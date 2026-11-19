// GET /v1/players/{uid}: the squads the tracker has seen (D117, spike #409). The field is not in the API docs,
// so only the fields we keep are read, and the rest of the body (history, alliance_members with their
// private fields, ranks) is dropped here: nothing of it is stored or logged.
import { z } from "zod";

import type { PlayerSquadsInput } from "./types";

const num = z.number().nullish();

const heroSchema = z.object({ id: z.number().int(), lv: num, star: num, q: num, awaken: num });

const squadSchema = z.object({
  squad: z.number().int(),
  power: z.number(),
  soldiers: num,
  soldier_load: num,
  // Not documented: epoch seconds (as `updated_at`), milliseconds or an ISO string are all read.
  seen_at: z.union([z.number(), z.string()]).nullish(),
  heroes: z.array(heroSchema).nullish(),
});

export const playerSchema = z.object({
  uid: z.number().int(),
  // Absent or null: the tracker has seen no squad of this player yet.
  squads: z.array(squadSchema).nullish(),
  // The quota after this call, as every /v1 body sends it: the squads read's guard reads it (D117).
  quota: z
    .object({ limit: z.number().int(), used: z.number().int(), remaining: z.number().int() })
    .nullish(),
});

function seenAt(v: number | string | null | undefined): Date | null {
  if (v === null || v === undefined) return null;
  // Measured 2026-11-18 (100 members): always an integer in epoch seconds. An all-digit string is read
  // as that number.
  const n = typeof v === "number" ? v : /^\d+$/.test(v) ? Number(v) : null;
  const at = n !== null ? new Date(n < 1e12 ? n * 1000 : n) : new Date(v);
  return Number.isNaN(at.getTime()) ? null : at;
}

export function toPlayerSquads(data: z.infer<typeof playerSchema>): PlayerSquadsInput {
  return {
    uid: data.uid,
    squads: (data.squads ?? []).map((s) => ({
      squad: s.squad,
      power: s.power,
      soldiers: s.soldiers ?? null,
      soldierLoad: s.soldier_load ?? null,
      seenAt: seenAt(s.seen_at),
      heroes: (s.heroes ?? []).map((h) => ({
        id: h.id,
        lv: h.lv ?? null,
        star: h.star ?? null,
        q: h.q ?? null,
        awaken: h.awaken ?? null,
      })),
    })),
    quota: data.quota ?? null,
  };
}
