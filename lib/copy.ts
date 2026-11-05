// Every user-facing string (docs/DESIGN.md "Language-light rules"). Keys are stable identifiers; values
// are the English text, so translation later is a file, not a refactor. The /brand page's text, the
// admin area's and the Discord messages' live in sibling files and are re-exported here, so there is one import path.
// `{name}` is a placeholder filled by `fill()`; labels on public pages are at most two words. Symbols
// (signs, arrows, `#`) stay in the components so the blank dictionary keeps them visible.
import { adminCopy } from "./copy-admin";
import { brandCopy } from "./copy-brand";
import { discordCopy } from "./copy-discord";

const source = {
  site: {
    name: "OG's LAP Tracker",
    shortName: "LAP Tracker",
    description: "Saturday event snapshots for server 325 alliances.",
    byline: "kept by the Old Grandmas",
    ledger: "Server 325 · Saturday Ledger",
    players: "Players",
    darkMode: "Dark mode",
    exactNumbers: "Exact numbers",
    events: "Events",
    latest: "latest",
    manualRound: "Manual round",
    breadcrumb: "Breadcrumb",
    home: "Ledger",
  },
  /** The words of one data row, at every depth. */
  ledger: {
    rank: "Rank",
    alliance: "Alliance",
    member: "Member",
    event: "Event",
    might: "Might",
    kills: "Kills",
    members: "Members",
    level: "Level",
    details: "Details",
    change: "Change",
    serverTime: "Server time",
    ranking: "Ranking",
    joined: "joined",
    left: "left",
    was: "was {name}",
    since: "since {date}",
    acrossEvents: "Across events",
    showAll: "All events ({n})",
    myAlliance: "My alliance",
    names: "Names",
    alliances: "Alliances",
  },
  /** Times are shown in server time, with this word after them. */
  time: {
    server: "server",
    /** The admin area spells it out. */
    serverTime: "server time",
  },
  status: {
    label: "Status",
    lastUpdated: "Last updated at {time}",
    lastFailed: "Last update failed at {time}",
    done: "done",
    partial: "partly done",
    failed: "failed",
    running: "Updating now",
    none: "Not updated yet",
    next: "Next update at {time}",
    byHand: "Run by hand by the admin",
    stale: "{n} stale",
  },
  /** The banner shown while the game's data service does not answer (DECISIONS D27). */
  upstream: {
    title: "Game data is delayed",
    body: "The data service is not answering, so these numbers may be out of date.",
    lastFresh: "Last fresh data at {time}",
  },
  fresh: {
    fresh: "Fresh",
    stale: "Stale",
    failed: "Failed",
    missing: "No data",
  },
  legend: {
    label: "Legend",
    up: "Up",
    down: "Down",
    same: "Same",
    stale: "Stale",
    rank: "Rank",
  },
  members: {
    search: "Member name",
    sort: "Sort",
    /** Sort chips: the figure's word, with ± for its change. */
    mightChange: "± Might",
    killsChange: "± Kills",
    byName: "A–Z",
    name: "Name",
    low: "Lowest might",
    high: "Highest might",
    clear: "Clear",
    clearAll: "Clear all",
    showAll: "Show all ({n})",
    highFirst: "Highest first",
    lowFirst: "Lowest first",
    joined: "Joined",
    left: "Left",
  },
  search: {
    title: "Players",
    placeholder: "Player name",
    submit: "Search",
    seen: "Seen",
    limit: "First {n}",
    noMatch: "No player by that name in the ledger.",
    pending: "Grandma is leafing through the ledger…",
  },
  errors: {
    notFound: {
      code: "404",
      title: "Grandma wandered off.",
      body: "This page isn't in the ledger.",
      back: "Back to the table",
    },
    server: {
      code: "500",
      title: "Something cracked.",
      body: "It's okay, grandma will clean it.",
      retry: "Try again",
      back: "Back to the table",
    },
  },
  empty: {
    kettle: "Nothing recorded yet. The kettle is on.",
    manualNotRun: "This round has not been run yet. The admin starts it by hand.",
    manualNoRows: "The run produced nothing. The admin runs it again by hand.",
    noEvents: "No events in the ledger yet.",
    noMembers: "Nobody here matches. Grandma checked twice.",
  },
  admin: adminCopy,
  brand: brandCopy,
  discord: discordCopy,
} as const;

/** `fill("Last updated at {time}", { time: "14:01" })`; unknown placeholders stay as written. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) =>
    key in vars ? String(vars[key]) : all,
  );
}

/** Pseudo-localisation (plan Phase 5f): every character but spaces and `{placeholders}` becomes `░`. */
export function blankCopy<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .split(/(\{\w+\})/)
      .map((part) => (/^\{\w+\}$/.test(part) ? part : part.replace(/\S/g, "░")))
      .join("") as T;
  }
  if (Array.isArray(value)) return value.map(blankCopy) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, blankCopy(v)])) as T;
  }
  return value;
}

/**
 * The game's own English UI words (DESIGN.md "Numbers first"): members read Might, Kills, Members and
 * Level in the game every day without reading English, so the blank dictionary keeps them.
 */
const GAME_TERMS = ["might", "kills", "members", "level"] as const;

/** Every value blanked except the game's own terms. */
export function blankDictionary<T extends { ledger: Record<(typeof GAME_TERMS)[number], string> }>(
  dictionary: T,
): T {
  const blank = blankCopy(dictionary);
  const kept = Object.fromEntries(GAME_TERMS.map((k) => [k, dictionary.ledger[k]]));
  return { ...blank, ledger: { ...blank.ledger, ...kept } };
}

// The blank dictionary is for the ten-second test only: a dev-time switch, inert in production builds
// (NODE_ENV is "production" there) and never set on Vercel. NEXT_PUBLIC_ so client components see it.
const BLANK = process.env.NEXT_PUBLIC_BLANK_COPY === "1" && process.env.NODE_ENV !== "production";

export const copy: typeof source = BLANK ? blankDictionary(source) : source;
