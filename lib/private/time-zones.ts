// The time-zone picker's search (issue #297, D80): every IANA zone Intl knows, found by city, by country
// name in English, Portuguese and French, by the abbreviations officers use (PST, CET, BRT, UK …) and
// by an offset ("Brazil -3", "UTC+1", "ST +3" = server time + 3). The stored value is always an IANA
// zone. Pure apart from Intl; the client picker, the paste parser and the sheet import share it.
import { offsetText } from "./calendar-time";
import { fold } from "./members-list";
import { ZONE_TABLE } from "./zone-table";

export interface Zone {
  /** The IANA name: the value stored. */
  id: string;
  /** ISO 3166 code; null for a fixed-offset Etc zone. */
  country: string | null;
  /** "Sao Paulo", or "UTC+1" for a fixed-offset zone. */
  city: string;
}

/**
 * Abbreviations and words officers use, each with the zones it stands for, the usual one first. Two
 * letters (PT, ET …) only in the picker: the paste parser skips them (lib/private/onboarding-parse.ts).
 */
const ABBREVIATIONS: Record<string, readonly string[]> = {
  pst: ["America/Los_Angeles", "America/Vancouver", "America/Tijuana"],
  mst: ["America/Denver", "America/Phoenix", "America/Edmonton"],
  cst: ["America/Chicago", "America/Mexico_City", "America/Winnipeg"],
  est: ["America/New_York", "America/Toronto", "America/Detroit"],
  akst: ["America/Anchorage"],
  hst: ["Pacific/Honolulu"],
  ast: ["America/Halifax", "America/Puerto_Rico"],
  nst: ["America/St_Johns"],
  brt: ["America/Sao_Paulo"],
  art: ["America/Argentina/Buenos_Aires"],
  gmt: ["Europe/London", "Europe/Dublin"],
  bst: ["Europe/London"],
  wet: ["Europe/Lisbon", "Atlantic/Canary"],
  cet: ["Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Brussels"],
  eet: ["Europe/Kyiv", "Europe/Athens", "Europe/Bucharest", "Europe/Helsinki"],
  msk: ["Europe/Moscow"],
  trt: ["Europe/Istanbul"],
  gst: ["Asia/Dubai"],
  pkt: ["Asia/Karachi"],
  ist: ["Asia/Kolkata", "Europe/Dublin", "Asia/Jerusalem"],
  ict: ["Asia/Bangkok", "Asia/Ho_Chi_Minh"],
  wib: ["Asia/Jakarta"],
  sgt: ["Asia/Singapore"],
  pht: ["Asia/Manila"],
  hkt: ["Asia/Hong_Kong"],
  jst: ["Asia/Tokyo"],
  kst: ["Asia/Seoul"],
  awst: ["Australia/Perth"],
  acst: ["Australia/Adelaide", "Australia/Darwin"],
  aest: ["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane"],
  nzst: ["Pacific/Auckland"],
};
/** Summer names and short forms of the same zones. */
const SAME_AS: Record<string, string> = {
  pdt: "pst",
  pt: "pst",
  pacific: "pst",
  mdt: "mst",
  mt: "mst",
  mountain: "mst",
  cdt: "cst",
  ct: "cst",
  central: "cst",
  edt: "est",
  et: "est",
  eastern: "est",
  akdt: "akst",
  adt: "ast",
  ndt: "nst",
  brst: "brt",
  brasilia: "brt",
  west: "wet",
  cest: "cet",
  eest: "eet",
  aedt: "aest",
  nzdt: "nzst",
};
export const abbreviation = (word: string): readonly string[] | undefined =>
  ABBREVIATIONS[SAME_AS[word] ?? word];

/** Other words for a country (folded); its names in the three languages come from Intl.DisplayNames. */
const COUNTRY_WORDS: Record<string, string> = {
  uk: "GB",
  england: "GB",
  britain: "GB",
  scotland: "GB",
  wales: "GB",
  inglaterra: "GB",
  angleterre: "GB",
  usa: "US",
  eua: "US",
  br: "BR",
  uae: "AE",
  holland: "NL",
  korea: "KR",
};

/** The usual zone of a country that has several, listed before the others. */
const MAIN_ZONES = new Set([
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "America/Argentina/Buenos_Aires",
  "America/Santiago",
  "America/Guayaquil",
  "Europe/Moscow",
  "Europe/Kyiv",
  "Europe/Madrid",
  "Europe/Lisbon",
  "Europe/Berlin",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Asia/Jakarta",
  "Asia/Shanghai",
  "Asia/Almaty",
  "Asia/Kuala_Lumpur",
  "Asia/Tashkent",
  "Asia/Nicosia",
  "Africa/Kinshasa",
  "America/Nuuk",
]);

const NAME_LANGUAGES = ["en", "pt-BR", "fr"] as const;
const words = (text: string) =>
  fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
const phrase = (text: string) => ` ${words(text).join(" ")} `;

interface Entry extends Zone {
  tokens: string[];
  /** Folded country names and words, each padded with spaces for a whole-phrase test. */
  countryPhrases: string[];
  cityPhrase: string;
  main: boolean;
}

let names: Intl.DisplayNames[] | null = null;
function countryNames(code: string): string[] {
  names ??= NAME_LANGUAGES.map((l) => new Intl.DisplayNames([l], { type: "region" }));
  const own = names.map((n) => n.of(code) ?? code).filter((n) => n !== code);
  const extra = Object.keys(COUNTRY_WORDS).filter((w) => COUNTRY_WORDS[w] === code);
  return [...own, ...extra];
}

const intlName = (id: string) => {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: id }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
};

function tableZones(): Map<string, string> {
  const country = new Map<string, string>();
  for (const line of ZONE_TABLE) {
    const [code, ...ids] = line.split(" ");
    for (const id of ids) country.set(id, code as string);
  }
  return country;
}

const cityOf = (id: string) => (id.split("/").at(-1) ?? id).replaceAll("_", " ");

let index: Entry[] | null = null;

/** Every zone Intl lists, under its IANA name (Intl may say Europe/Kiev for Europe/Kyiv). */
function entries(): Entry[] {
  if (index) return index;
  const country = tableZones();
  const listed = Intl.supportedValuesOf("timeZone");
  const known = new Set(listed);
  const iana = new Map<string, string>();
  for (const id of country.keys()) if (!known.has(id)) iana.set(intlName(id) ?? id, id);
  const ids = [...new Set(listed.map((id) => iana.get(id) ?? id))];
  const perCountry = new Map<string, number>();
  for (const code of country.values()) perCountry.set(code, (perCountry.get(code) ?? 0) + 1);
  index = ids.map((id) => {
    const code = country.get(id) ?? null;
    const named = code ? countryNames(code) : [];
    const abbreviations = Object.keys({ ...ABBREVIATIONS, ...SAME_AS }).filter((w) =>
      abbreviation(w)?.includes(id),
    );
    return {
      id,
      country: code,
      city: cityOf(id),
      tokens: [
        ...words(id),
        ...(id.startsWith("Europe/") ? ["eu"] : []),
        ...(code ? [code.toLowerCase(), ...named.flatMap(words)] : []),
        ...abbreviations,
      ],
      countryPhrases: named.map(phrase),
      cityPhrase: phrase(cityOf(id)),
      main: MAIN_ZONES.has(id) || (code !== null && perCountry.get(code) === 1),
    };
  });
  return index;
}

const offsetFormats = new Map<string, Intl.DateTimeFormat>();

/** The zone's offset from UTC at `at`, in minutes (UTC−3 is −180). */
export function offsetMinutes(zone: string, at: Date): number {
  let format = offsetFormats.get(zone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" });
    offsetFormats.set(zone, format);
  }
  const name = format.formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** "UTC+2", "UTC−3", "UTC+5:30": the one offset form (`offsetText`, lib/calendar-time.ts). */
export const offsetLabel = offsetText;

/** The fixed-offset IANA zone for a whole-hour offset (UTC+1 is Etc/GMT-1); null otherwise. */
export function fixedZone(minutes: number): Zone | null {
  if (minutes % 60 !== 0 || minutes < -720 || minutes > 840) return null;
  const hours = -minutes / 60;
  const id = hours === 0 ? "Etc/UTC" : `Etc/GMT${hours > 0 ? "+" : ""}${hours}`;
  return { id, country: null, city: offsetLabel(minutes) };
}

/** An offset in the text: "-3", "UTC+1", "GMT+5:30", "ST +3" (server time plus 3 hours). */
const OFFSET = /(?:^|\s)(st|utc|gmt)?\s*([+\-−])\s*(\d{1,2})(?:[:.h]?(\d{2}))?(?=\s|$)/u;

export interface ZoneQuery {
  words: string[];
  /** Minutes from UTC; null when the text names no offset. */
  offset: number | null;
}

export function parseZoneQuery(text: string, now: Date, serverZone: string): ZoneQuery {
  const folded = fold(text).replace(/[,;/()]/g, " ");
  const m = OFFSET.exec(folded);
  if (!m) return { words: words(folded), offset: null };
  const base = m[1] === "st" ? offsetMinutes(serverZone, now) : 0;
  const size = Number(m[3]) * 60 + Number(m[4] ?? 0);
  const offset = base + (m[2] === "+" ? size : -size);
  const rest = folded.slice(0, m.index) + " " + folded.slice(m.index + m[0].length);
  return { words: words(rest), offset: offset >= -720 && offset <= 840 ? offset : null };
}

export interface SearchOptions {
  now: Date;
  serverZone: string;
  /** Zones already used in the alliance, most used first: they come first. */
  used?: readonly string[];
}

const at = (list: readonly string[] | undefined, id: string) => {
  const i = list?.indexOf(id) ?? -1;
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
};

/** The zones that fit a query typed in the picker, best first: every word starts a word of the zone. */
export function searchZones(text: string, o: SearchOptions): Zone[] {
  const q = parseZoneQuery(text, o.now, o.serverZone);
  const named = q.words.map((w) => abbreviation(w)).find((list) => list !== undefined);
  const hits = entries().filter(
    (e) =>
      q.words.every((w) => e.tokens.some((t) => t.startsWith(w))) &&
      (q.offset === null || offsetMinutes(e.id, o.now) === q.offset),
  );
  // "uk" is a whole word of London's (United Kingdom) and only the start of Kyiv's (Ukraine).
  const exact = (e: Entry) => q.words.every((w) => e.tokens.includes(w));
  hits.sort(
    (a, b) =>
      at(o.used, a.id) - at(o.used, b.id) ||
      at(named, a.id) - at(named, b.id) ||
      Number(exact(b)) - Number(exact(a)) ||
      Number(b.main) - Number(a.main) ||
      a.city.localeCompare(b.city),
  );
  const fixed = q.offset !== null && q.words.length === 0 ? fixedZone(q.offset) : null;
  return [
    ...(fixed ? [fixed] : []),
    ...hits.map(({ id, country, city }) => ({ id, country, city })),
  ];
}

export interface NamedZones {
  /** IANA zones, best first. */
  zones: string[];
  /** The first is the one meant: an abbreviation, a country's usual zone, one city, or an offset alone. */
  sure: boolean;
  /** What named them; the paste parser trusts a city or an offset only next to "time zone". */
  via: "abbreviation" | "country" | "city" | "offset" | null;
}

/**
 * The zones a short text names, as a member writes them ("PST", "uk time zone", "Brazil -3", "ST +3"):
 * an abbreviation, else a country, else a city, else an offset alone (a fixed zone). Whole words only.
 */
export function zonesNamed(text: string, now: Date, serverZone: string): NamedZones {
  const q = parseZoneQuery(text, now, serverZone);
  const fits = (id: string) => q.offset === null || offsetMinutes(id, now) === q.offset;
  const padded = ` ${q.words.join(" ")} `;
  const all = entries();
  const countries = new Set(
    all.filter((e) => e.countryPhrases.some((p) => padded.includes(p))).map((e) => e.country),
  );
  const listed = q.words.map((w) => abbreviation(w)).find((list) => list !== undefined);
  if (listed) {
    const zones = listed.filter(
      (id) =>
        fits(id) &&
        (countries.size === 0 || all.some((e) => e.id === id && countries.has(e.country))),
    );
    if (zones.length > 0) return { zones, sure: true, via: "abbreviation" };
  }
  const inCountry = all.filter((e) => countries.has(e.country) && fits(e.id));
  if (inCountry.length > 0) {
    inCountry.sort((a, b) => Number(b.main) - Number(a.main) || a.city.localeCompare(b.city));
    const sure = inCountry.length === 1 || (inCountry[0] as Entry).main;
    return { zones: inCountry.map((e) => e.id), sure, via: "country" };
  }
  const cities = all.filter((e) => padded.includes(e.cityPhrase) && fits(e.id)).map((e) => e.id);
  if (cities.length > 0) return { zones: cities, sure: cities.length === 1, via: "city" };
  // "ST +3", "EU +1": an offset and no place, so the fixed zone of that offset.
  const fixed = q.offset === null ? null : fixedZone(q.offset);
  return fixed
    ? { zones: [fixed.id], sure: true, via: "offset" }
    : { zones: [], sure: false, via: null };
}

/**
 * The offset of someone whose clock reads `hhmm` ("14:05") at `now`, to the nearest quarter hour,
 * between UTC−12 and UTC+14; null when it is not a time.
 */
export function offsetFromLocalTime(hhmm: string, now: Date): number | null {
  const m = /^(\d{1,2})[:.h](\d{2})$/.exec(hhmm.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  let diff = Math.round((Number(m[1]) * 60 + Number(m[2]) - utc) / 15) * 15;
  if (diff > 840) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

/** The zones whose clock reads `hhmm` now, best first (used in the alliance, then a country's usual zone). */
export function zonesAtLocalTime(hhmm: string, o: SearchOptions): Zone[] {
  const offset = offsetFromLocalTime(hhmm, o.now);
  if (offset === null) return [];
  const sign = offset < 0 ? "-" : "+";
  const a = Math.abs(offset);
  const query = `utc${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
  return searchZones(query, o).filter((z) => z.country !== null);
}
