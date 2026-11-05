// Seed data from fixtures/ for scripts/seed.ts: rosters that drift per snapshot, plus the scripted
// changes every UI state needs (plan Phase 5). Deterministic: reseeding gives the same numbers.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface BaseMember {
  uid: number;
  name: string;
  power: number;
  kills: number;
  lv: number;
  avatarUrl: string | null;
}
export interface BaseAlliance {
  unionId: number;
  tag: string;
  name: string;
  level: number;
  badgeId: number | null;
  members: BaseMember[];
}

const FIXTURES = join(import.meta.dirname, "../fixtures");

/** Fixture rosters by union_id: fixtures/v1-ids/<id>.json, else the latest fixtures/v1-<ts>/alliance-<id>.json. */
export function loadBase(): BaseAlliance[] {
  const bodies = new Map<number, Record<string, unknown>>();
  for (const dir of readdirSync(FIXTURES)
    .filter((d) => d.startsWith("v1-"))
    .sort()) {
    for (const file of readdirSync(join(FIXTURES, dir))) {
      const id = /^(?:alliance-)?(\d+)\.json$/.exec(file)?.[1];
      if (id) bodies.set(Number(id), JSON.parse(readFileSync(join(FIXTURES, dir, file), "utf8")));
    }
  }
  return [...bodies]
    .map(([unionId, b]) => ({
      unionId,
      tag: String(b.abbr),
      name: String(b.name),
      level: Number(b.level ?? 1),
      badgeId: typeof b.badge_id === "number" ? b.badge_id : null,
      members: (b.members as Record<string, unknown>[]).map((m) => ({
        uid: Number(m.uid),
        name: String(m.nick_name),
        power: Number(m.power ?? 0),
        kills: Number(m.kills ?? 0),
        lv: Number(m.lv ?? 1),
        // Every fifth member without a photo, so the drawn placeholder shows; fake on purpose.
        avatarUrl: Number(m.uid) % 5 === 0 ? null : String(m.avatar_url ?? "") || null,
      })),
    }))
    .sort(
      (a, b) =>
        b.members.reduce((s, m) => s + m.power, 0) - a.members.reduce((s, m) => s + m.power, 0),
    );
}

/** A stable number in [0, 1) from integers, so reseeding gives the same data. */
function noise(...parts: number[]): number {
  let h = 2166136261;
  for (const p of parts) h = Math.imul(h ^ (p % 2 ** 31), 16777619) ^ (p / 2 ** 31);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 2 ** 32;
}

export type Phase = "before" | "after";
export const phaseIndex = (event: number, phase: Phase) => event * 2 + (phase === "after" ? 1 : 0);

export interface Roster {
  tag: string;
  name: string;
  members: BaseMember[];
}

/** A member's power and kills at a snapshot: drifting up with the step. */
const drifted = (m: BaseMember, step: number): BaseMember => ({
  ...m,
  power: Math.round(m.power * (0.9 + 0.02 * step + 0.01 * noise(m.uid, step))),
  kills: Math.round(m.kills * (0.86 + 0.03 * step + 0.01 * noise(m.uid, step + 9))),
});

/** The first member of alliance 5 moves to alliance 6 during event 1 and stays there. */
function applyMove(
  base: BaseAlliance[],
  index: number,
  members: BaseMember[],
  moved: boolean,
  step: number,
): BaseMember[] {
  if (!moved) return members;
  if (index === 5) return members.slice(1);
  if (index !== 6) return members;
  return [...members, drifted((base[5] as BaseAlliance).members[0] as BaseMember, step)];
}

/** Members with power and kills drifting up per snapshot; the scripted changes are applied on top. */
export function rosterAt(base: BaseAlliance[], index: number, event: number, phase: Phase): Roster {
  const a = base[index] as BaseAlliance;
  const step = phaseIndex(event, phase);
  let members = a.members.map((m) => drifted(m, step));
  let { tag, name } = a;
  if (index === 1 && event === 0) [tag, name] = ["OLD", "Seed Former Name"]; // renamed alliance; fake on purpose
  const last = event === 2 && phase === "after";
  if (index === 3 && last) members = members.slice(2); // two members leave: kills fall
  members = applyMove(
    base,
    index,
    members,
    event === 2 || (event === 1 && phase === "after"),
    step,
  );
  if (index === 7 && last) {
    members = members.map((m, i) => (i === 3 ? { ...m, name: `${m.name} ★` } : m)); // renamed member
  }
  return { tag, name, members };
}
