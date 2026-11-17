// The Members list's filters, counts and orders (issue 337, D98), pure and browser-safe: the page turns
// each MemberRow into a small ListMember on the server, and the list filters, counts and orders those in
// the browser as the officer types and taps. Missing data never matches a filter and is never sorted as 0
// (D75): it goes to its own group at the end, and so does a member on a break, in every order.
import { zonedInstant, zoneOffset } from "./calendar-time";
import type { MemberFacts } from "./fact-fields";
import type { MemberRow } from "./members";

/** The facts an officer can ask a member for ("Info to ask"); languages count (owner, 2026-11-17). */
export const ASK_FACTS = ["squadMight", "troopTier", "adTech", "timeZone", "languages"] as const;
export type AskFact = (typeof ASK_FACTS)[number];

/** "Who" in the Filters sheet: one choice at a time. */
export const WHO = ["checkin", "help", "break", "new"] as const;
export type Who = (typeof WHO)[number];

/** Rank then might (default), might and kills both ways, main squad high to low. */
export const ORDERS = ["rank", "might", "might-asc", "kills", "kills-asc", "squad"] as const;
export type Order = (typeof ORDERS)[number];

/** "Daytime for them" is 08:00–22:59 on the member's own clock; anything else is night (owner, 2026-11-17). */
export const DAY_FROM = 8 * 60;
export const DAY_TO = 23 * 60;

export type TimeMode = "day" | "night";

export interface MemberQuery {
  /** The name search, as typed. */
  q: string;
  r4: boolean;
  ask: boolean;
  who: Who | null;
  /** Daytime or night for them when the server clock reads `hour`:00. */
  time: { mode: TimeMode; hour: number } | null;
  /** A code of LANGUAGES. */
  lang: string | null;
}

export const NO_QUERY: MemberQuery = {
  q: "",
  r4: false,
  ask: false,
  who: null,
  time: null,
  lang: null,
};

/** What the list filters and orders on; the page adds the words it shows. */
export interface ListMember {
  uid: number;
  name: string;
  rankCode: number | null;
  might: number | null;
  kills: number | null;
  /** Main squad might (a fact). */
  squad: number | null;
  /** The member's IANA zone (a fact). */
  zone: string | null;
  languages: string[];
  ask: AskFact[];
  who: Who[];
}

/** The facts not recorded yet: never written, cleared, or (languages) an empty list. */
export function factsToAsk(facts: MemberFacts): AskFact[] {
  return ASK_FACTS.filter((f) => {
    const value = facts[f]?.value;
    return value === null || value === undefined || (Array.isArray(value) && value.length === 0);
  });
}

/** Every "Who" the member is: an officer's status leaves Check in (#297); an away note running is a break. */
export function whoOf(m: MemberRow): Who[] {
  const onBreak = m.officerStatus === "break" || m.awayUntil !== null;
  return [
    ...(m.reasons.length > 0 && m.officerStatus === null ? (["checkin"] as const) : []),
    ...(m.officerStatus === "help" ? (["help"] as const) : []),
    ...(onBreak ? (["break"] as const) : []),
    ...(m.isNew ? (["new"] as const) : []),
  ];
}

export function listMember(m: MemberRow): ListMember {
  return {
    uid: m.uid,
    name: m.name,
    rankCode: m.rankCode,
    might: m.might,
    kills: m.kills,
    squad: m.facts.squadMight?.value ?? null,
    zone: m.facts.timeZone?.value ?? null,
    languages: m.facts.languages?.value ?? [],
    ask: factsToAsk(m.facts),
    who: whoOf(m),
  };
}

/** Lower case without accents, so "laeti" finds "Laëti38". */
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();

/** The minute on a zone's clock when the server's clock reads `hour`:00 on `today`; memoised per call site. */
export function clockAt(today: string, serverZone: string) {
  const seen = new Map<string, number>();
  return (zone: string, hour: number): number => {
    const key = `${zone} ${hour}`;
    let minute = seen.get(key);
    if (minute === undefined) {
      const at = zonedInstant(today, hour * 60, serverZone);
      const shift = zoneOffset(zone, at) - zoneOffset(serverZone, at);
      minute = (((hour * 60 + shift) % 1440) + 1440) % 1440;
      seen.set(key, minute);
    }
    return minute;
  };
}
export type Clock = ReturnType<typeof clockAt>;

export const isDaytime = (minute: number) => minute >= DAY_FROM && minute < DAY_TO;

/** Whether the member's clock fits; null when their time zone is not known (they match neither). */
function fitsTime(m: ListMember, time: NonNullable<MemberQuery["time"]>, clock: Clock) {
  if (m.zone === null) return null;
  return isDaytime(clock(m.zone, time.hour)) === (time.mode === "day");
}

const found = (m: ListMember, q: string) => {
  const needle = fold(q.trim());
  return needle === "" || fold(m.name).includes(needle);
};

function keeps(m: ListMember, query: MemberQuery, clock: Clock): boolean {
  return (
    found(m, query.q) &&
    (!query.r4 || (m.rankCode ?? 0) >= 104) &&
    (!query.ask || m.ask.length > 0) &&
    (query.who === null || m.who.includes(query.who)) &&
    (query.time === null || fitsTime(m, query.time, clock) === true) &&
    (query.lang === null || m.languages.includes(query.lang))
  );
}

/** The members the query keeps, in their order, and how many a time filter cannot judge (no time zone). */
export function keepMembers<M extends ListMember>(rows: M[], query: MemberQuery, clock: Clock) {
  const kept = rows.filter((m) => keeps(m, query, clock));
  const noZone =
    query.time === null
      ? 0
      : rows.filter((m) => m.zone === null && keeps(m, { ...query, time: null }, clock)).length;
  return { kept, noZone };
}

/** The languages someone has, in LANGUAGES order (the caller passes LANGUAGES). */
export const languagesIn = (rows: ListMember[], order: readonly string[]) =>
  order.filter((code) => rows.some((m) => m.languages.includes(code)));

/**
 * Each option's count: how many members the list would hold with that option chosen, the search and every
 * other filter applied. `hours` gives, for each server hour, the count in daytime and at night.
 */
export function facetCounts(rows: ListMember[], query: MemberQuery, clock: Clock, langs: string[]) {
  const count = (change: Partial<MemberQuery>) =>
    rows.filter((m) => keeps(m, { ...query, ...change }, clock)).length;
  const hours = (mode: TimeMode) =>
    Array.from({ length: 24 }, (_, hour) => count({ time: { mode, hour } }));
  return {
    r4: count({ r4: true }),
    ask: count({ ask: true }),
    who: Object.fromEntries(
      [...WHO, "any"].map((w) => [w, count({ who: w === "any" ? null : (w as Who) })]),
    ) as Record<Who | "any", number>,
    lang: Object.fromEntries(langs.map((code) => [code, count({ lang: code })])),
    langAny: count({ lang: null }),
    timeAny: count({ time: null }),
    hours: { day: hours("day"), night: hours("night") },
  };
}
export type FacetCounts = ReturnType<typeof facetCounts>;

const VALUE: Record<Exclude<Order, "rank">, (m: ListMember) => number | null> = {
  might: (m) => m.might,
  "might-asc": (m) => m.might,
  kills: (m) => m.kills,
  "kills-asc": (m) => m.kills,
  squad: (m) => m.squad,
};

/**
 * The members in `order`: the ranked ones, then those with no value ("—"), then those on a break, each
 * group in the order it came in (the page's default order). Ties keep that order too.
 */
export function orderMembers<M extends ListMember>(rows: M[], order: Order) {
  const onBreak = rows.filter((m) => m.who.includes("break"));
  const rest = rows.filter((m) => !m.who.includes("break"));
  if (order === "rank") {
    const noValue = rest.filter((m) => m.rankCode === null);
    const ranked = rest
      .filter((m) => m.rankCode !== null)
      .sort((a, b) => (b.rankCode ?? 0) - (a.rankCode ?? 0) || (b.might ?? -1) - (a.might ?? -1));
    return { ranked, noValue, onBreak };
  }
  const value = VALUE[order];
  const sign = order.endsWith("-asc") ? 1 : -1;
  const ranked = rest
    .filter((m) => value(m) !== null)
    .sort((a, b) => sign * ((value(a) as number) - (value(b) as number)));
  return { ranked, noValue: rest.filter((m) => value(m) === null), onBreak };
}

/** Old `?f=` links ("4 people to check in with") keep working; "missing" and "all" mean everyone. */
const OLD_F: Record<string, Partial<MemberQuery>> = {
  checkin: { who: "checkin" },
  new: { who: "new" },
  r4: { r4: true },
};

const hourOf = (raw: string | null) =>
  raw !== null && /^\d{1,2}$/.test(raw) && Number(raw) < 24 ? Number(raw) : null;

/** The address as a query (a system boundary): unknown or out-of-range values are left out. */
export function pickQuery(params: URLSearchParams, languages: readonly string[]): MemberQuery {
  const who = params.get("who");
  const lang = params.get("lang");
  const [day, night] = [hourOf(params.get("day")), hourOf(params.get("night"))];
  return {
    ...NO_QUERY,
    ...OLD_F[params.get("f") ?? ""],
    q: (params.get("q") ?? "").slice(0, 64),
    ...(params.get("r4") === "1" && { r4: true }),
    ...(params.get("ask") === "1" && { ask: true }),
    ...(WHO.includes(who as Who) && { who: who as Who }),
    ...(day !== null
      ? { time: { mode: "day" as const, hour: day } }
      : night !== null && { time: { mode: "night" as const, hour: night } }),
    ...(lang !== null && languages.includes(lang) && { lang }),
  };
}

export const pickOrder = (raw: string | null | undefined): Order | null =>
  ORDERS.find((o) => o === raw) ?? null;

/** The query and order as the address writes them; the default order is left out. */
export function queryString(query: MemberQuery, order: Order): string {
  const p = new URLSearchParams();
  if (query.q.trim()) p.set("q", query.q);
  if (query.r4) p.set("r4", "1");
  if (query.ask) p.set("ask", "1");
  if (query.who) p.set("who", query.who);
  if (query.time) p.set(query.time.mode, String(query.time.hour));
  if (query.lang) p.set("lang", query.lang);
  if (order !== "rank") p.set("order", order);
  return p.toString();
}

/** How many sheet filters are on (Who, Time, Language): the "Filters · n" button. */
export const sheetFilters = (query: MemberQuery) =>
  Number(query.who !== null) + Number(query.time !== null) + Number(query.lang !== null);
