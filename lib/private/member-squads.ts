// The member card's "Squads (from the tracker)" (issue 413, D117): each stored squad's newest row, its
// might and heroes with name, level and stars, and when the tracker saw it, as words in the officer's
// language. Only the workspace's own alliance (access.unionId, D71). Pictures come from /img/hero/[id],
// and only for heroes in the catalog; any other id is a plain placeholder.
import { fill } from "../copy";
import type { Db } from "../db";
import { heroNames } from "../repo/hero-catalog";
import { latestSquads, type StoredSquad } from "../repo/squads";
import type { WorkspaceAccess } from "./access";
import type { WorkspaceDictionary } from "./dictionary";

export type { StoredSquad };

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
}

export type Rarity = "R" | "SSR" | "UR";
const RARITY: Record<number, Rarity> = { 3: "R", 4: "SSR", 5: "UR" };

export interface SquadCard {
  squad: number;
  title: string;
  might: string;
  /** "seen Tue, Nov 17"; null when the tracker sent no time. */
  seen: string | null;
  heroes: HeroCard[];
}

export interface SquadsCard {
  head: string;
  help: string;
  /** The line shown when the tracker has seen none of their squads. */
  none: string;
  squads: SquadCard[];
}

export interface SquadFormats {
  compact: (n: number) => string;
  date: (at: Date) => string;
  language: string;
}

/** UR, then SSR, then R (`q`), then more stars, then a higher level: the tracker site's order. */
const byRank = (a: StoredSquad["heroes"][number], b: StoredSquad["heroes"][number]) =>
  (b.q ?? 0) - (a.q ?? 0) || (b.star ?? 0) - (a.star ?? 0) || (b.lv ?? 0) - (a.lv ?? 0);

function heroCard(
  h: StoredSquad["heroes"][number],
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
  };
}

/** The section's words from the stored squads (pure). */
export function squadsCardOf(
  squads: readonly StoredSquad[],
  names: Map<number, string>,
  t: WorkspaceDictionary,
  f: SquadFormats,
): SquadsCard {
  return {
    head: t["squads.head"],
    help: t["squads.help"],
    none: t["squads.none"],
    squads: [...squads]
      .sort((a, b) => a.squad - b.squad)
      .map((s) => ({
        squad: s.squad,
        title: fill(t["squads.name"], { n: s.squad }),
        might: fill(t["squads.might"], { v: f.compact(s.power) }),
        seen: s.seenAt ? fill(t["squads.seen"], { date: f.date(s.seenAt) }) : null,
        heroes: [...s.heroes].sort(byRank).map((h) => heroCard(h, names, t, f)),
      })),
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
  const [squads, names] = await Promise.all([latestSquads(db, access.unionId, uid), heroNames(db)]);
  return squadsCardOf(squads, names, t, f);
}
