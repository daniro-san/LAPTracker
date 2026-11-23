// The words of the Insights page's Time zones card (owner, 2026-11-22), pure: the largest group and its
// reset, how many have a time zone, each group's row (its bar is a share of the members with a zone, D68) with
// now, the reset and KvK on the group's own clock, and the members within their usual hours. A zone is its
// offset at the instant shown ("UTC−3") and a time its zone's clock (`dateWords`). Not recorded is a count
// with no bar, never in a share (D75). Each group's row carries its members, its count that list's length
// (#678); not recorded and usual hours link to Members' own filters (`NOT_RECORDED`, `usualAt`).
import { dateWords } from "../date-words";
import { fill, plural } from "../words";
import { dayIn, hhmm, offsetText } from "./calendar-time";
import { type Formats } from "./insights-format";
import { setOf, type Who } from "./insights-sets";
import type { BarRow } from "./insights-words";
import {
  busiestHours,
  cityOf,
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
    /** Its bar: the members with no time zone, out of all members, on the rows' scale (D158). */
    missingShare: number;
    /** The server hours with the most members in their usual hours; null with fewer than 2 groups. */
    usual: Usual | null;
  } | null;
}

type ZoneFormats = Formats & {
  serverZone: string;
  today: string;
  /** Everyone a set can name (`InsightsView.people`). */
  people: Map<number, Omit<Who, "uid">>;
};

/** "Paris, Zurich and 1 more": the group's IANA cities; a fixed-offset zone (Etc/…) names none. */
function citiesOf(g: ZoneGroup, f: Formats): string | null {
  const cities = g.zones.map(cityOf).filter((c) => c !== null);
  if (cities.length === 0) return null;
  const shown = cities.slice(0, CITIES).join(", ");
  return cities.length > CITIES
    ? fill(
        plural(
          cities.length - CITIES,
          { one: f.t["insights.zones.more.one"], other: f.t["insights.zones.more.other"] },
          f.language,
        ),
        { n: cities.length - CITIES, cities: shown },
      )
    : shown;
}

/** "Paris, Zurich · UTC+1" in a row, "Paris, Zurich (UTC+1)" in a sentence; the offset alone with no city. */
function nameOf(g: ZoneGroup, f: Formats, key: "insights.zones.row" | "insights.zones.named") {
  const offset = offsetText(g.offsets.now);
  const cities = citiesOf(g, f);
  return cities === null ? offset : fill(f.t[key], { cities, offset });
}

/** `at` on the group's clock: its time, and its weekday when asked or when its date is not the server's then. */
function clockOf(g: ZoneGroup, at: Date, f: ZoneFormats, weekday: boolean) {
  const zone = g.zones[0] as string;
  const words = dateWords(f.language, zone);
  const otherDay = dayIn(zone, at.getTime()) !== dayIn(f.serverZone, at.getTime());
  return { day: weekday || otherDay ? words.weekday(at) : null, time: words.time(at) };
}

/** "Sun 21:00" in a row's line. */
const clockText = (c: ReturnType<typeof clockOf>) => (c.day ? `${c.day} ${c.time}` : c.time);

/** "às 02:00", "dom. às 21:00": a time inside a sentence, as each language joins it. */
const clockInSentence = (c: ReturnType<typeof clockOf>, f: Formats) =>
  c.day
    ? fill(f.t["insights.zones.atDay"], { day: c.day, time: c.time })
    : fill(f.t["insights.zones.at"], { time: c.time });

/** "Clocks change before KvK" or "… before the reset": the earlier moment whose offset is not now's. */
function changeOf(g: ZoneGroup, m: Moments, f: Formats): string | null {
  const moments = [
    { at: m.reset, offset: g.offsets.reset, key: "insights.zones.changeReset" as const },
    { at: m.kvk, offset: g.offsets.kvk, key: "insights.zones.changeKvk" as const },
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const first = moments.find((x) => x.offset !== g.offsets.now);
  return first ? f.t[first.key] : null;
}

const listOf = (items: string[], language: string) =>
  new Intl.ListFormat(language, { type: "conjunction" }).format(items);

function headline(groups: ZoneGroup[], known: number, m: Moments, f: ZoneFormats): string {
  const { t, language } = f;
  const top = Math.max(...groups.map((g) => g.uids.length));
  const largest = groups.filter((g) => g.uids.length === top);
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
          : fill(
              plural(
                top,
                { one: t["insights.zones.tie.one"], other: t["insights.zones.tie.other"] },
                language,
              ),
              { n: top, groups: largest.map(named).join(", ") },
            );
  const resets = [
    ...new Set(largest.map((g) => clockInSentence(clockOf(g, m.reset, f, false), f))),
  ];
  return `${first} ${fill(t["insights.zones.reset"], { times: listOf(resets, language) })}`;
}

function usualLine(c: ZoneCounts, known: number, f: ZoneFormats): Usual | null {
  const runs = busiestHours(usualHours(c, f.today, f.serverZone));
  const first = runs[0];
  if (!first) return null;
  const hours = runs.map((r) => `${hhmm(r.from * 60)}–${hhmm(r.to * 60 + 59)}`);
  return {
    line: fill(
      plural(
        c.members - known,
        { one: f.t["insights.zones.usual.one"], other: f.t["insights.zones.usual.other"] },
        f.language,
      ),
      { n: c.members - known, hours: listOf(hours, f.language), count: first.n, known },
    ),
    hour: first.from,
  };
}

/** The card's words; `m` holds the page's instant, the next reset and the next KvK start. */
export function zonesWords(c: ZoneCounts, m: Moments, f: ZoneFormats): ZonesWords {
  const { t, language } = f;
  const known = knownOf(c);
  if (known === 0)
    return {
      based: [
        fill(
          plural(
            c.members,
            { one: t["insights.zones.none.one"], other: t["insights.zones.none.other"] },
            language,
          ),
          { n: c.members },
        ),
      ],
      details: null,
    };
  const groups = zoneGroups(c, m);
  const server = dateWords(language, f.serverZone);
  return {
    based: [
      headline(groups, known, m, f),
      fill(
        plural(
          c.members,
          { one: t["insights.zones.based.one"], other: t["insights.zones.based.other"] },
          language,
        ),
        { n: c.members, known },
      ),
    ],
    details: {
      legend: fill(t["insights.zones.legend"], {
        now: server.time(m.now),
        kvk: server.at(m.kvk),
        members: c.members,
      }),
      rows: groups.map((g, i) => ({
        label: nameOf(g, f, "insights.zones.row"),
        value: String(g.uids.length),
        // Out of every member, not only those with a time zone (D158): 2 of 11 is not 2 of 3.
        share: g.uids.length / c.members,
        set: setOf("zone", `zone-${i}`, g.uids, f.people, language),
        times: fill(t["insights.zones.times"], {
          now: clockText(clockOf(g, m.now, f, false)),
          reset: clockText(clockOf(g, m.reset, f, false)),
          kvk: clockText(clockOf(g, m.kvk, f, true)),
        }),
        change: changeOf(g, m, f),
      })),
      missing: c.members > known ? String(c.members - known) : null,
      missingShare: (c.members - known) / c.members,
      usual: groups.length >= 2 ? usualLine(c, known, f) : null,
    },
  };
}
