// The words of the Insights page's Time zones card (owner, 2026-11-22), pure: the largest group and its
// reset, how many have a time zone, each group's row (its bar is a share of the members with a zone, D68) with
// now, the reset and KvK on the group's own clock, and the members within their usual hours. A zone is its
// offset at the instant shown ("UTC−3") and a time its zone's clock (`dateWords`). Not recorded is a count
// with no bar, never in a share (D75). Counts only.
import { fill } from "../copy";
import { dateWords } from "../date-words";
import { dayIn, hhmm, offsetText } from "./calendar-time";
import { counted, type Formats } from "./insights-format";
import type { BarRow } from "./insights-words";
import {
  busiestHours,
  knownOf,
  usualHours,
  zoneGroups,
  type Moments,
  type ZoneCounts,
  type ZoneGroup,
} from "./insights-zones";

/** Cities named in a group's label; the rest are "and N more". */
const CITIES = 2;

export interface ZoneRow extends BarRow {
  /** "Now 10:00 · Reset Sun 21:00 · KvK Sat 09:00". */
  times: string;
  /** "Clocks change before KvK", when the group's offset now differs from the one at a moment. */
  change: string | null;
}

/** "Within their usual hours for the most: 11:00–12:59 ST, …" and the first hour, for "See who". */
interface Usual {
  line: string;
  hour: number;
}

export interface ZonesWords {
  /** Shown without a tap: the largest group and its reset, then how many have a time zone. */
  based: string[];
  /** Behind "Show the details"; null when no member has a time zone (no rows, no fold). */
  details: {
    legend: string;
    rows: ZoneRow[];
    /** "Not recorded yet": the count; null when every member has a time zone. */
    missing: string | null;
    /** The server hours with the most members in their usual hours; null with fewer than 2 groups. */
    usual: Usual | null;
  } | null;
}

type ZoneFormats = Formats & { serverZone: string; today: string };

/** "Paris, Zurich and 1 more": the group's IANA cities; a fixed-offset zone (Etc/…) names none. */
function citiesOf(g: ZoneGroup, f: Formats): string | null {
  const cities = g.zones
    .filter((z) => !z.startsWith("Etc/"))
    .map((z) => (z.split("/").at(-1) ?? z).replaceAll("_", " "));
  if (cities.length === 0) return null;
  const shown = cities.slice(0, CITIES).join(", ");
  return cities.length > CITIES
    ? fill(f.t["insights.zones.more"], { cities: shown, n: cities.length - CITIES })
    : shown;
}

/** "Paris, Zurich · UTC+1" in a row, "Paris, Zurich (UTC+1)" in a sentence; the offset alone with no city. */
function nameOf(g: ZoneGroup, f: Formats, key: "insights.zones.row" | "insights.zones.named") {
  const offset = offsetText(g.offsets.now);
  const cities = citiesOf(g, f);
  return cities === null ? offset : fill(f.t[key], { cities, offset });
}

/** `at` on the group's clock; its weekday when asked, or when its date is not the server's date then. */
function clockOf(g: ZoneGroup, at: Date, f: ZoneFormats, weekday: boolean) {
  const zone = g.zones[0] as string;
  const words = dateWords(f.language, zone);
  const otherDay = dayIn(zone, at.getTime()) !== dayIn(f.serverZone, at.getTime());
  return weekday || otherDay ? `${words.weekday(at)} ${words.time(at)}` : words.time(at);
}

const listOf = (items: string[], language: string) =>
  new Intl.ListFormat(language, { type: "conjunction" }).format(items);

function headline(groups: ZoneGroup[], known: number, m: Moments, f: ZoneFormats): string {
  const { t, language } = f;
  const top = Math.max(...groups.map((g) => g.n));
  const largest = groups.filter((g) => g.n === top);
  const named = (g: ZoneGroup) => nameOf(g, f, "insights.zones.named");
  const first =
    known === 1
      ? fill(t["insights.zones.one"], { group: named(largest[0] as ZoneGroup) })
      : groups.length === 1
        ? fill(t["insights.zones.all"], { known, group: named(largest[0] as ZoneGroup) })
        : largest.length === 1
          ? fill(t["insights.zones.largest"], {
              group: named(largest[0] as ZoneGroup),
              n: top,
              known,
            })
          : counted(t, "insights.zones.tie", top, language, {
              groups: largest.map(named).join(", "),
            });
  const resets = [...new Set(largest.map((g) => clockOf(g, m.reset, f, false)))];
  return `${first} ${fill(t["insights.zones.reset"], { times: listOf(resets, language) })}`;
}

function usualLine(c: ZoneCounts, known: number, f: ZoneFormats): Usual | null {
  const runs = busiestHours(usualHours(c, f.today, f.serverZone));
  const first = runs[0];
  if (!first) return null;
  const hours = runs.map((r) => `${hhmm(r.from * 60)}–${hhmm(r.to * 60 + 59)}`);
  return {
    line: fill(f.t["insights.zones.usual"], {
      hours: listOf(hours, f.language),
      n: first.n,
      known,
      missing: c.members - known,
    }),
    hour: first.from,
  };
}

/** The card's words; `m` holds the page's instant, the next reset and the next KvK start. */
export function zonesWords(c: ZoneCounts, m: Moments, f: ZoneFormats): ZonesWords {
  const { t, language } = f;
  const known = knownOf(c);
  if (known === 0)
    return { based: [counted(t, "insights.zones.none", c.members, language)], details: null };
  const groups = zoneGroups(c, m);
  const server = dateWords(language, f.serverZone);
  return {
    based: [
      headline(groups, known, m, f),
      counted(t, "insights.zones.based", c.members, language, { known }),
    ],
    details: {
      legend: fill(t["insights.zones.legend"], {
        now: server.time(m.now),
        kvk: server.at(m.kvk),
        known,
      }),
      rows: groups.map((g) => ({
        label: nameOf(g, f, "insights.zones.row"),
        value: String(g.n),
        share: g.n / known,
        times: fill(t["insights.zones.times"], {
          now: clockOf(g, m.now, f, false),
          reset: clockOf(g, m.reset, f, false),
          kvk: clockOf(g, m.kvk, f, true),
        }),
        change:
          g.offsets.reset !== g.offsets.now
            ? t["insights.zones.changeReset"]
            : g.offsets.kvk !== g.offsets.now
              ? t["insights.zones.changeKvk"]
              : null,
      })),
      missing: c.members > known ? String(c.members - known) : null,
      usual: groups.length >= 2 ? usualLine(c, known, f) : null,
    },
  };
}
