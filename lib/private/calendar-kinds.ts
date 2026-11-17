// The calendar's fixed facts (issue 300), with no imports, so client components can use them without
// pulling in the input schemas (zod): the kinds of entry the alliance plans (owner, 2026-11-16: the game's
// Event tab list is not seeded), the level range, the Elixir Scramble windows and the daily Alliance Duel.
export const KINDS = ["caravan", "cheese", "undead", "elixir", "kvk", "duel", "other"] as const;
export type Kind = (typeof KINDS)[number];

/** The level an officer picks for Cheese Trap and Undead Siege: 1 to 10 (owner: "maybe more later"). */
export const LEVEL_MAX = 10;
/** Elixir Scramble's three windows, server time, 30 minutes each (in-game screen; owner, 2026-11-16). */
export const ELIXIR_WINDOWS = [9 * 60, 18 * 60, 23 * 60] as const;
export const ELIXIR_MINUTES = 30;
/**
 * The Alliance Duel's theme of each server day, Monday first, in the game's English (D52; owner,
 * 2026-11-16). Fixed by the game, so a map in code, not an entry; Sunday has none.
 */
export const DUEL_DAYS = [
  "Raven",
  "Building",
  "Research",
  "Heroes",
  "Training",
  "Raid",
  null,
] as const;
