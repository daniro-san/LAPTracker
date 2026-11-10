// Every user-facing string (docs/DESIGN.md "Language-light rules"). Keys are stable identifiers; values
// are the English text. The public pages' strings (`en`) are also written in the languages of
// `LANGUAGES`, one translation per file in lib/i18n/ (D48); a page reads its request's dictionary through
// requestCopy or useCopy (app/_ui/locale.ts, LocaleProvider). The /brand page's text, the admin area's
// and the Discord messages' stay English: they live in sibling files and are re-exported in `copy`, so
// there is one import path.
// `{name}` is a placeholder filled by `fill()`; labels on public pages are at most two words. Symbols
// (signs, arrows, `#`) stay in the components so the blank dictionary keeps them visible.
import { adminCopy } from "./copy-admin";
import { brandCopy } from "./copy-brand";
import { discordCopy } from "./copy-discord";

/** The public pages' strings in English: the source every other language's dictionary follows. */
export const en = {
  site: {
    name: "Event Ledger",
    shortName: "Ledger",
    description: "Event snapshots for server 325 alliances.",
    byline: "kept by the Old Grandmas",
    ledger: "Server 325 · Event Ledger",
    disclaimer:
      "Event Ledger is a fan-made community project for the Last Asylum Plague game. It is not an official 37Games or Eyu website, and it is not affiliated with Last Asylum Plague. Game names and artwork belong to their owners.",
    players: "Players",
    darkMode: "Dark mode",
    settings: "Settings",
    exactNumbers: "Exact numbers",
    events: "Events",
    /** The closed event selector on pages that span every event (the player pages). */
    allEvents: "All events",
    latest: "latest",
    manualRound: "Manual round",
    breadcrumb: "Breadcrumb",
    home: "Ledger",
    /** The first Tab stop of every public page: jumps past the header to `main`. */
    skip: "Skip to the ledger",
    disclaimerShort: "Fan-made. Not affiliated with 37Games, Eyu or Last Asylum Plague.",
    /** The footer's disclosure that opens the full `disclaimer`. */
    disclaimerMore: "More",
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
    player: "Player",
    asOf: "As of {time}",
    details: "Details",
    change: "Change",
    serverTime: "Server time",
    yourTime: "Your time",
    ranking: "Ranking",
    joined: "joined",
    left: "left",
    was: "was {name}",
    since: "since {date}",
    acrossEvents: "Across events",
    toTop: "Back up",
    showAll: "All events ({n})",
    myAlliance: "My alliance",
    names: "Names",
    alliances: "Alliances",
    /** The event's biggest gains and losses (#70). */
    movers: "Grandma noticed",
  },
  /** Event vs event (D57, #177): two events' in-event changes side by side. */
  compare: {
    title: "Event vs event",
    /** The page's <title> and the event page's link target name: `Oct 24 vs Oct 31`. */
    versus: "{a} vs {b}",
    /** The event page's link and the picker's button. */
    action: "Compare",
    first: "First event",
    second: "Second event",
    swap: "Swap the events",
    /** Under the title: what each line's numbers are. */
    lead: "Each line is the change during that event, from Before to After. The last line is the second event's change minus the first's.",
    allAlliances: "All alliances",
    /** Under the totals: how many alliances they cover. */
    counted: "{n} of {total} alliances, those with usable data in both events",
    /** Details: the reference values from the first event to the second. */
    between: "From one event to the other",
    notIn: "not in alliance",
    same: "Pick two different events.",
    onlyOne: "There is only one event to compare so far.",
  },
  /** Member history (D60, #197): an alliance's rosters over time, each compared with the one before. */
  history: {
    title: "Member history",
    /** Under the title: what each card is. */
    lead: "Each card compares the member list with the one read before it. Changes in between are not seen.",
    /** A card's head for a roster from the once-a-day read. */
    daily: "Daily read",
    /** Under a card's head: `since Nov 8, 06:01 server time`. */
    since: "since {time}",
    first: "First reading: nothing to compare yet.",
    noChange: "No member changes.",
    renamed: "Renamed",
    /** Beside a member who left, when they are now in another tracked alliance. */
    nowIn: "now in {tag}",
    /** The filter links' group label and its first link. */
    show: "Show",
    all: "All",
    older: "Older",
    newest: "Newest",
    /** Nothing on this page matches the filter. */
    none: "Nothing of this kind on this page.",
    /** Copies the card's whole member list as tab-separated rows (name, might, kills). */
    copy: "Copy for spreadsheet",
    copied: "Copied",
    copyFailed: "Copy failed",
  },
  /** The header's settings menu (D38). */
  settings: {
    language: "Language",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    times: "Times",
    serverTime: "Server time",
    yourTime: "Your time",
    dates: "Dates",
    auto: "Auto",
  },
  /** Times are shown in server time, or in the viewer's own zone (D38), with these words after them. */
  time: {
    serverTime: "server time",
    yourTime: "your time",
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
    /** Rows whose After failed, counted apart from the stale ones (`status.failed` is the phase's word). */
    failedRows: "{n} failed",
    /** The capture window's labels (issue 180): `START 10:00 → END 13:01 server time`, when the Before
     * snapshot was taken and when the After was. */
    start: "Start",
    end: "End",
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
    rounded: "Rounded",
    /** The footnote mark `*` on a falling Might or Kills change when members left. */
    members: "Includes member changes",
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
    /** Beside the member count while a filter is on. */
    shown: "{n} shown",
    highFirst: "Highest first",
    lowFirst: "Lowest first",
    joined: "Joined",
    left: "Left",
  },
  /** The alliance's R5 and titled R4 officers: a section on the alliance page, a mark in the member list. */
  leadership: {
    title: "Leadership",
    leader: "Leader",
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
      back: "Back to the ledger",
    },
    server: {
      code: "500",
      title: "Something cracked.",
      body: "It's okay, grandma will clean it.",
      retry: "Try again",
      back: "Back to the ledger",
    },
  },
  empty: {
    kettle: "Nothing recorded yet. The kettle is on.",
    manualNotRun: "This round has not been run yet. The admin starts it by hand.",
    manualNoRows: "The run produced nothing. The admin runs it again by hand.",
    noEvents: "No events in the ledger yet.",
    noMembers: "Nobody here matches. Grandma checked twice.",
  },
} as const;

/** A page's words: `en`'s keys, any text. */
type Strings<T> = { readonly [K in keyof T]: T[K] extends string ? string : Strings<T[K]> };
export type Dictionary = Strings<typeof en>;

/** One language's file (lib/i18n/): any of `en`'s keys, so a key added in English reads English until it
 * is translated (scripts/i18n-check.ts reports it); an extra or misspelt key fails tsc. */
type Partly<T> = { readonly [K in keyof T]?: T[K] extends string ? string : Partly<T[K]> };
export type Translation = Partly<typeof en>;

type Tree = { readonly [key: string]: string | Tree };

function overlay(base: Tree, over: Tree | undefined): Tree {
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => {
      const mine = over?.[key];
      if (typeof value === "string") return [key, typeof mine === "string" ? mine : value];
      return [key, overlay(value, typeof mine === "object" ? mine : undefined)];
    }),
  );
}

/** A translation with every missing key filled from English. */
export const withEnglish = (translation: Translation): Dictionary =>
  overlay(en, translation as Tree) as unknown as Dictionary;

/** The languages the public pages are written in (D48), in the switcher's order; the one registry. */
export const LANGUAGES = [
  "en",
  "es",
  "pt-BR",
  "fr",
  "de",
  "it",
  "nl",
  "sv",
  "pl",
  "ru",
  "uk",
  "tr",
  "zh-CN",
  "ja",
  "ko",
  "id",
  "vi",
  "th",
] as const;
export type Language = (typeof LANGUAGES)[number];

/** A `lang` cookie value on the list, else null. */
export const parseLanguage = (value: string | undefined): Language | null =>
  (LANGUAGES as readonly string[]).includes(value ?? "") ? (value as Language) : null;

const source = {
  ...en,
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
 * The game's own UI words (DESIGN.md "Numbers first"): members read Might, Kills, Members and Level in the
 * game every day, so the blank dictionary keeps them. A language uses the game's word for them where its
 * glossary sources one, else the English (D52).
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
export const BLANK =
  process.env.NEXT_PUBLIC_BLANK_COPY === "1" && process.env.NODE_ENV !== "production";

export const copy: typeof source = BLANK ? blankDictionary(source) : source;
