// The member card's "Squads (from the tracker)" (issue 413, D117): each stored squad's newest row, its
// might and heroes with name, rarity, level and stars, when the tracker saw it and what changed since the
// row before, as words in the officer's language. The strongest squad and the one top hero are marked
// (owner, 2026-11-18). Only the workspace's own alliance (access.unionId, D71). Pictures come from
// /img/hero/[id], and only for heroes in the catalog; any other id is a plain placeholder.
import { fill } from "../copy";
import type { Db } from "../db";
import { heroNames } from "../repo/hero-catalog";
import { squadPairs, type StoredSquad } from "../repo/squads";
import { mainSquad } from "../squads";
import type { WorkspaceAccess } from "./access";
import type { WorkspaceDictionary } from "./dictionary";

export type { StoredSquad };

/** One squad number: its newest stored row and the one before it, when there is one. */
export interface SquadPair {
  latest: StoredSquad;
  previous: StoredSquad | null;
}

export interface HeroCard {
  id: number;
  /** In the catalog: /img/hero/[id] has a picture. */
  known: boolean;
  name: string;
  /** "Lv 80"; null when the tracker sent no level. */
  level: string | null;
  /** The game's rarity from `q` (3 R, 4 SSR, 5 UR, owner 2026-11-18); null for any other value. */
  rarity: Rarity | null;
  /** Whole stars as the site shows them: floor(star / 5), 0–10. */
  stars: number;
  /** "4 stars", for screen readers. */
  starsLabel: string;
  /** The member's one top hero (D117's rule: rarity, then stars, then level). */
  top: boolean;
}

export type Rarity = "R" | "SSR" | "UR";
const RARITY: Record<number, Rarity> = { 3: "R", 4: "SSR", 5: "UR" };

export interface SquadCard {
  squad: number;
  title: string;
  might: string;
  /** The highest power of the member's squads: its power is "Main squad might". */
  strongest: boolean;
  /** "seen Tue, Nov 17"; null when the tracker sent no time. */
  seen: string | null;
  /** "+1.2M since Mon, Nov 16" against the row before; null when there is none or the power is the same. */
  change: string | null;
  /** "Heroes changed" when the row before had other heroes, levels or stars; else null. */
  heroesChanged: string | null;
  heroes: HeroCard[];
}

export interface SquadsCard {
  head: string;
  help: string;
  /** How the top hero is picked, said once under the heading (nothing is hover-only). */
  topRule: string;
  strongestTag: string;
  topTag: string;
  /** The line shown when the tracker has seen none of their squads. */
  none: string;
  squads: SquadCard[];
}

export interface SquadFormats {
  compact: (n: number) => string;
  date: (at: Date) => string;
  language: string;
}

type Hero = StoredSquad["heroes"][number];

/** UR, then SSR, then R (`q`), then more stars, then a higher level: the site's order and the top hero rule. */
const byRank = (a: Hero, b: Hero) =>
  (b.q ?? 0) - (a.q ?? 0) || (b.star ?? 0) - (a.star ?? 0) || (b.lv ?? 0) - (a.lv ?? 0);

function heroCard(
  h: Hero,
  names: Map<number, string>,
  t: WorkspaceDictionary,
  f: SquadFormats,
): HeroCard {
  const name = names.get(h.id);
  const stars = Math.floor((h.star ?? 0) / 5);
  const plural = new Intl.PluralRules(f.language).select(stars) === "one" ? "one" : "other";
  return {
    id: h.id,
    known: name !== undefined,
    name: name ?? t["squads.unknownHero"],
    level: h.lv === null ? null : fill(t["squads.level"], { n: h.lv }),
    rarity: (h.q !== null && RARITY[h.q]) || null,
    stars,
    starsLabel: fill(t[`squads.stars.${plural}`], { n: stars }),
    top: false,
  };
}

/** The heroes as one comparable string: who, at which level, with how many stars. */
const heroesKey = (heroes: readonly Hero[]) =>
  [...heroes]
    .sort((a, b) => a.id - b.id)
    .map((h) => `${h.id}:${h.lv}:${h.star}`)
    .join(";");

/** "+1.2M since …" or "−400K since …", in plain ink (D75: a drop is information, not a warning). */
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
  return {
    squad: s.squad,
    title: fill(t["squads.name"], { n: s.squad }),
    might: fill(t["squads.might"], { v: f.compact(s.power) }),
    strongest,
    seen: s.seenAt ? fill(t["squads.seen"], { date: f.date(s.seenAt) }) : null,
    change: changeLine(p, t, f),
    heroesChanged: changed ? t["squads.heroesChanged"] : null,
    heroes: [...s.heroes].sort(byRank).map((h) => heroCard(h, names, t, f)),
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
  const squads = sorted.map((p) => squadCard(p, p.latest.squad === strongest, names, t, f));
  // The top hero: each squad's first hero is its best, so the best of those, the lower squad on a tie.
  const best = sorted
    .map((p, i) => ({ i, hero: [...p.latest.heroes].sort(byRank)[0] }))
    .filter((c): c is { i: number; hero: Hero } => c.hero !== undefined)
    .sort((a, b) => byRank(a.hero, b.hero) || a.i - b.i)[0];
  const topHero = best ? squads[best.i]?.heroes[0] : undefined;
  if (topHero) topHero.top = true;
  return {
    head: t["squads.head"],
    help: t["squads.help"],
    topRule: t["squads.topRule"],
    strongestTag: t["squads.strongest"],
    topTag: t["squads.topHero"],
    none: t["squads.none"],
    squads,
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
