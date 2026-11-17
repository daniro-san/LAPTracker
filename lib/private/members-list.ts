// The Members list's filters, counts and orders (issue 337, D98), pure and browser-safe: the page turns
// each member into a small ListMember on the server, and the list filters, counts and orders those in
// the browser as the officer types and taps. Missing data never matches a filter and is never sorted as 0
// (D75): it is counted on its own "Not shown" line, or goes to its own group at the end, and so does a
// member on a break, in every order.
import { zonedInstant, zoneOffset } from "./calendar-time";
import type { MemberFacts } from "./fact-fields";
import type { MemberRow } from "./members";

/** The facts an officer can ask a member for ("Info to ask"); languages count (owner, 2026-11-17). */
export const ASK_FACTS = ["squadMight", "troopTier", "adTech", "timeZone", "languages"] as const;
export type AskFact = (typeof ASK_FACTS)[number];
/** Info to ask: any fact missing (the chip), or the one a "Not shown … See who" line names. */
export const ASK_KINDS = ["any", "timeZone", "languages"] as const;
export type AskKind = (typeof ASK_KINDS)[number];

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
  /** The name search, as typed; it also finds past names. */
  q: string;
  r4: boolean;
  ask: AskKind | null;
  who: Who | null;
  /** Daytime or night for them when the server clock reads `hour`:00. */
  time: { mode: TimeMode; hour: number } | null;
  /** A code of LANGUAGES. */
  lang: string | null;
}

export const NO_QUERY: MemberQuery = {
  q: "",
  r4: false,
  ask: null,
  who: null,
  time: null,
  lang: null,
};

/** What the list filters and orders on; the page adds the words it shows. */
export interface ListMember {
  uid: number;
  name: string;
  /** Names the member used before in this alliance, newest first. */
  pastNames: string[];
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

/**
 * The members the list's "Check in and Needs help" group holds, and the one count Members and Home show
 * for it (ADV-9): Check in or Needs help, not on a break (a break has its own group at the end).
 */
export const needsAWord = (who: readonly Who[]) =>
  (who.includes("checkin") || who.includes("help")) && !who.includes("break");

export function listMember(m: MemberRow & { pastNames: string[] }): ListMember {
  return {
    uid: m.uid,
    name: m.name,
    pastNames: m.pastNames,
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

/** Each member's names folded once: the current name first, then the past ones. */
const foldedNames = new WeakMap<ListMember, string[]>();
function namesOf(m: ListMember): string[] {
  let names = foldedNames.get(m);
  if (!names) {
    names = [m.name, ...m.pastNames].map(fold);
    foldedNames.set(m, names);
  }
  return names;
}

/** The past name the search found, when the current name does not hold it ("was Mara"); else null. */
export function pastMatch(m: ListMember, q: string): string | null {
  const needle = fold(q.trim());
  if (needle === "") return null;
  const [current = "", ...past] = namesOf(m);
  if (current.includes(needle)) return null;
  const i = past.findIndex((n) => n.includes(needle));
  return i < 0 ? null : (m.pastNames[i] ?? null);
}

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

/** A query with its search folded once, for one pass over the rows. */
type Ready = MemberQuery & { needle: string };
const ready = (query: MemberQuery): Ready => ({ ...query, needle: fold(query.q.trim()) });

const asks = (m: ListMember, ask: AskKind) =>
  ask === "any" ? m.ask.length > 0 : m.ask.includes(ask);

function keepsFacts(m: ListMember, q: Ready, clock: Clock): boolean {
  // No time zone matches neither daytime nor night; no language matches no language (D75).
  const time = q.time;
  if (time && (m.zone === null || isDaytime(clock(m.zone, time.hour)) !== (time.mode === "day")))
    return false;
  return q.lang === null || m.languages.includes(q.lang);
}

function keeps(m: ListMember, q: Ready, clock: Clock): boolean {
  return (
    (q.needle === "" || namesOf(m).some((n) => n.includes(q.needle))) &&
    (!q.r4 || (m.rankCode ?? 0) >= 104) &&
    (q.ask === null || asks(m, q.ask)) &&
    (q.who === null || m.who.includes(q.who)) &&
    keepsFacts(m, q, clock)
  );
}

/**
 * The members the query keeps, in their order, and how many the time or language filter cannot judge:
 * those that pass every other filter but have no time zone, or no language, recorded.
 */
export function keepMembers<M extends ListMember>(rows: M[], query: MemberQuery, clock: Clock) {
  const q = ready(query);
  const kept = rows.filter((m) => keeps(m, q, clock));
  const unjudged = (change: Partial<MemberQuery>, missing: (m: M) => boolean) =>
    rows.filter((m) => missing(m) && keeps(m, { ...q, ...change }, clock)).length;
  return {
    kept,
    noZone: q.time === null ? 0 : unjudged({ time: null }, (m) => m.zone === null),
    noLanguage: q.lang === null ? 0 : unjudged({ lang: null }, (m) => m.languages.length === 0),
  };
}

/** The languages someone has, in LANGUAGES order (the caller passes LANGUAGES). */
export const languagesIn = (rows: ListMember[], order: readonly string[]) =>
  order.filter((code) => rows.some((m) => m.languages.includes(code)));

function counter(rows: ListMember[], query: MemberQuery, clock: Clock) {
  const q = ready(query);
  return (change: Partial<MemberQuery>) =>
    rows.filter((m) => keeps(m, { ...q, ...change }, clock)).length;
}

/** The two chips' counts: the list each would give, with the search and every other filter applied. */
export function chipCounts(rows: ListMember[], query: MemberQuery, clock: Clock) {
  const count = counter(rows, query, clock);
  return { r4: count({ r4: true }), ask: count({ ask: "any" }) };
}

/**
 * The Filters sheet's counts, made only while it is open: each Who and language option, and for each
 * server hour the count in daytime and at night, with the search and every other filter applied.
 */
export function sheetCounts(rows: ListMember[], query: MemberQuery, clock: Clock, langs: string[]) {
  const count = counter(rows, query, clock);
  const hours = (mode: TimeMode) =>
    Array.from({ length: 24 }, (_, hour) => count({ time: { mode, hour } }));
  const whoCount = (w: Who | "any") => count({ who: w === "any" ? null : w });
  return {
    who: Object.fromEntries([...WHO, "any" as const].map((w) => [w, whoCount(w)])) as Record<
      Who | "any",
      number
    >,
    lang: Object.fromEntries(langs.map((code) => [code, count({ lang: code })])),
    langAny: count({ lang: null }),
    hours: { day: hours("day"), night: hours("night") },
  };
}
export type SheetCounts = ReturnType<typeof sheetCounts>;

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
const askOf = (raw: string | null): AskKind | null =>
  raw === "1" ? "any" : (ASK_KINDS.find((k) => k !== "any" && k === raw) ?? null);

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
    ...(askOf(params.get("ask")) && { ask: askOf(params.get("ask")) }),
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
  if (query.ask) p.set("ask", query.ask === "any" ? "1" : query.ask);
  if (query.who) p.set("who", query.who);
  if (query.time) p.set(query.time.mode, String(query.time.hour));
  if (query.lang) p.set("lang", query.lang);
  if (order !== "rank") p.set("order", order);
  return p.toString();
}

/** How many sheet filters are on (Who, Time, Language): the "Filters · n" button. */
export const sheetFilters = (query: MemberQuery) =>
  Number(query.who !== null) + Number(query.time !== null) + Number(query.lang !== null);
