// The member card's "Squads (from the tracker)" (issue 413, D117): each stored squad's newest row, its
// might and heroes with name, rarity, level, star level and Hall of Honor level, when the tracker saw it
// (server time, and the instant for the viewer's own clock) and what changed since the row before, as words
// in the officer's language. The strongest squad is marked (owner, 2026-11-18). Heroes keep the API's
// order, which is the game's slot order (owner, 2026-11-20, issue 461; D136): 5 slots, a missing one empty.
// Troops are never read here (owner, issue 461).
// Only the workspace's own alliance (access.unionId, D71). Pictures come from /img/hero/[id], and only for
// heroes in the catalog; any other id is a plain placeholder.
import { fill } from "../copy";
import type { Db } from "../db";
import { heroNames } from "../repo/hero-catalog";
import { squadPairs, type StoredSquad } from "../repo/squads";
import { mainSquad } from "../squads";
import type { WorkspaceAccess } from "./access";
import { dayIn } from "./calendar-time";
import type { WorkspaceDictionary } from "./dictionary";

export type { StoredSquad };

/** One squad number: its newest stored row and the one before it, when there is one. */
export interface SquadPair {
  latest: StoredSquad;
  previous: StoredSquad | null;
}

/** The game's rarity from `q`: 3 SR, 4 SSR, 5 UR (the owner's game screenshots, 2026-11-18). */
export type Rarity = "SR" | "SSR" | "UR";
const RARITY: Record<number, Rarity> = { 3: "SR", 4: "SSR", 5: "UR" };

/** One of the five star icons: its colour, and the next colour filling it from the left by `part`. */
export interface StarIcon {
  base: "empty" | "yellow" | "red";
  /** The colour this star takes at the next level, drawn over `base` up to `part` (0 < part < 1). */
  next: "yellow" | "red" | null;
  part: number;
}

/** Star levels run 0–10; `star` runs 0–50, so each level has 5 sub-steps. */
export const STAR_LEVELS = 10;
const ICONS = 5;

/** The star level, 0–10: `floor(star / 5)`. */
export const starLevel = (star: number | null) =>
  Math.min(STAR_LEVELS, Math.max(0, Math.floor((star ?? 0) / 5)));

/**
 * The game's five star icons for a raw `star` (0–50). Levels 1–5 fill them yellow from the left; levels
 * 6–10 turn them red from the left (level 7: 2 red, 3 yellow). The sub-steps toward the next level fill
 * the next icon by `(star % 5) / 5` in the colour it will become.
 */
export function starIcons(star: number | null): StarIcon[] {
  const raw = Math.min(STAR_LEVELS * 5, Math.max(0, star ?? 0));
  const level = starLevel(raw);
  const part = level < STAR_LEVELS ? (raw % 5) / 5 : 0;
  const red = Math.max(0, level - ICONS);
  const yellow = Math.min(level, ICONS);
  return Array.from({ length: ICONS }, (_, i) => {
    const base = i < red ? "red" : i < yellow ? "yellow" : "empty";
    // The icon the next level changes: past the yellow ones below level 5, past the red ones from 5 on.
    const nextIndex = level < ICONS ? yellow : red;
    const next = part > 0 && i === nextIndex ? (level < ICONS ? "yellow" : "red") : null;
    return { base, next, part: next ? part : 0 };
  });
}

export interface HeroCard {
  id: number;
  /** In the catalog: /img/hero/[id] has a picture. */
  known: boolean;
  name: string;
  /** "Lv 80"; null when the tracker sent no level. */
  level: string | null;
  /** SR, SSR or UR; null for any other `q`. */
  rarity: Rarity | null;
  stars: StarIcon[];
  /** "Star level 7 of 10": the meaning without the colours. */
  starsLabel: string;
  /** "Honor 42": the Hall of Honor level; null at 0 (most heroes) and on rows stored before D132. */
  honor: string | null;
}

/** A squad always has 5 slots (owner, 2026-11-20); the API's `heroes[]` order is the game's slot order. */
export const SLOTS = 5;

export interface SquadCard {
  squad: number;
  title: string;
  might: string;
  /** The highest power of the member's squads: its power is "Main squad might". */
  strongest: boolean;
  /** "seen Tue, Nov 17, 22:32 ST"; null when the tracker sent no time. */
  seen: string | null;
  /** The sighting's instant (ms) and its server day, for the viewer's own clock beside it; null with no time. */
  seenAt: { at: number; day: string } | null;
  /** "8 h ago", "2 days ago": how old the sighting is when the card is made; null with no time. */
  age: string | null;
  /** "+1.20M since Mon, Nov 16" against the row before; null when there is none or the power is the same. */
  change: string | null;
  /** "Heroes changed" when the row before had other heroes, levels or stars; else null. */
  heroesChanged: string | null;
  /** The 5 slots in the API's order: 1–2 the front row, 3–5 the back row (owner, 2026-11-21; D136). */
  slots: (HeroCard | null)[];
  /** "1 slot empty", plain information (D75); null when all 5 are filled. */
  empty: string | null;
}

export interface SquadsCard {
  head: string;
  help: string;
  /** "3 squads seen · last Thu, Nov 19"; null with none. */
  summary: string | null;
  /** "Slot {n}" for the list in slot order, and the words of the viewer's clock ("01:32 your time"). */
  slotWord: string;
  emptySlot: string;
  clock: { yours: string; nextDay: string; prevDay: string };
  strongestTag: string;
  /** The line shown when the tracker has seen none of their squads. */
  none: string;
  squads: SquadCard[];
}

export interface SquadFormats {
  compact: (n: number) => string;
  date: (at: Date) => string;
  /** "Thu, Nov 19 22:32" on the server's clock. */
  time: (at: Date) => string;
  language: string;
  /** The server's time zone (SERVER_TZ). */
  zone: string;
  /** When the card is made, for each sighting's age. */
  now: Date;
}

type Hero = StoredSquad["heroes"][number];

function heroCard(h: Hero, names: Map<number, string>, t: WorkspaceDictionary): HeroCard {
  const name = names.get(h.id);
  return {
    id: h.id,
    known: name !== undefined,
    name: name ?? t["squads.unknownHero"],
    level: h.lv === null ? null : fill(t["squads.level"], { n: h.lv }),
    rarity: (h.q !== null && RARITY[h.q]) || null,
    stars: starIcons(h.star),
    starsLabel: fill(t["squads.starLevel"], { n: starLevel(h.star) }),
    honor: h.honor ? fill(t["squads.honor"], { n: h.honor }) : null,
  };
}

/** The heroes as one comparable string: who, at which level, with how many stars. */
const heroesKey = (heroes: readonly Hero[]) =>
  [...heroes]
    .sort((a, b) => a.id - b.id)
    .map((h) => `${h.id}:${h.lv}:${h.star}`)
    .join(";");

/** "8 h ago" under 2 days, then "3 days ago": plain information, never a warning (D75). */
function ageOf(at: Date, t: WorkspaceDictionary, now: Date): string {
  const hours = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 3_600_000));
  return hours < 48
    ? fill(t["squads.age.hours"], { n: hours })
    : fill(t["squads.age.days"], { n: Math.floor(hours / 24) });
}

/** "+1.20M since …" or "−400K since …", in plain ink (D75: a drop is information, not a warning). */
function changeLine(p: SquadPair, t: WorkspaceDictionary, f: SquadFormats): string | null {
  if (!p.previous) return null;
  const delta = p.latest.power - p.previous.power;
  if (delta === 0) return null;
  const sign = delta > 0 ? "+" : "−";
  const date = f.date(p.previous.seenAt ?? p.previous.readAt);
  return fill(t["squads.change"], { delta: `${sign}${f.compact(Math.abs(delta))}`, date });
}

function squadCard(
  p: SquadPair,
  strongest: boolean,
  names: Map<number, string>,
  t: WorkspaceDictionary,
  f: SquadFormats,
): SquadCard {
  const s = p.latest;
  const changed = p.previous && heroesKey(p.previous.heroes) !== heroesKey(s.heroes);
  const slots = Array.from({ length: SLOTS }, (_, i) => {
    const h = s.heroes[i];
    return h ? heroCard(h, names, t) : null;
  });
  const empty = slots.filter((h) => h === null).length;
  return {
    squad: s.squad,
    title: fill(t["squads.name"], { n: s.squad }),
    might: fill(t["squads.might"], { v: f.compact(s.power) }),
    strongest,
    seen: s.seenAt ? fill(t["squads.seen"], { date: f.time(s.seenAt) }) : null,
    seenAt: s.seenAt ? { at: s.seenAt.getTime(), day: dayIn(f.zone, s.seenAt.getTime()) } : null,
    age: s.seenAt ? ageOf(s.seenAt, t, f.now) : null,
    change: changeLine(p, t, f),
    heroesChanged: changed ? t["squads.heroesChanged"] : null,
    slots,
    empty:
      empty === 0
        ? null
        : fill(t[empty === 1 ? "squads.empty.one" : "squads.empty.other"], { n: empty }),
  };
}

/** The section's words from the stored squads (pure), in squad-number order. */
export function squadsCardOf(
  pairs: readonly SquadPair[],
  names: Map<number, string>,
  t: WorkspaceDictionary,
  f: SquadFormats,
): SquadsCard {
  const sorted = [...pairs].sort((a, b) => a.latest.squad - b.latest.squad);
  const strongest = mainSquad(sorted.map((p) => p.latest))?.squad ?? null;
  const last = sorted
    .map((p) => p.latest.seenAt ?? p.latest.readAt)
    .reduce<Date | null>((a, b) => (a && a > b ? a : b), null);
  return {
    head: t["squads.head"],
    help: t["squads.help"],
    summary: last
      ? fill(t[sorted.length === 1 ? "squads.summary.one" : "squads.summary.other"], {
          n: sorted.length,
          date: f.date(last),
        })
      : null,
    slotWord: t["squads.slot"],
    emptySlot: t["squads.emptySlot"],
    clock: {
      yours: t["calendar.yours"],
      nextDay: t["calendar.nextDay"],
      prevDay: t["calendar.prevDay"],
    },
    strongestTag: t["squads.strongest"],
    none: t["squads.none"],
    squads: sorted.map((p) => squadCard(p, p.latest.squad === strongest, names, t, f)),
  };
}

/** One member's squads, for the card; the uid is already known to be in the workspace's alliance. */
export async function squadsCard(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  t: WorkspaceDictionary,
  f: SquadFormats,
): Promise<SquadsCard> {
  const [pairs, names] = await Promise.all([squadPairs(db, access.unionId, uid), heroNames(db)]);
  return squadsCardOf(pairs, names, t, f);
}
