// The words of the Insights page's Usual hours card and of the member card's usual-hours line (issue 873,
// D163), pure: the server hours most members are usually in game around, how many members have enough
// readings, one row per server hour (its bar a share of the members with enough readings, D68), and the one
// line on the bias. Never "online now". Hours end in ST; the officer's own time is added in the browser.
import { fill } from "../words";
import { hhmm } from "./calendar-time";
import type { Formats } from "./insights-format";
import { busiestHours } from "./insights-zones";
import { USUAL_MIN_READINGS, type Band, type HourCounts, type Usual } from "./usual-hours";

/** "20:00–22:59": a band's hours, which may run through midnight. */
export const bandText = (b: Pick<Band, "from" | "to">) =>
  `${hhmm(b.from * 60)}–${hhmm(b.to * 60 + 59)}`;

export interface UsualRow {
  /** The server hour 0–23. */
  hour: number;
  /** "20:00 ST". */
  st: string;
  value: string;
  share: number;
}

export interface UsualWords {
  based: string[];
  /** Behind "Show the details"; null when no member has enough readings. */
  details: { legend: string; rows: UsualRow[] } | null;
}

/** The card's words for `c`. */
export function usualWords(c: HourCounts, f: Formats): UsualWords {
  const { t, language } = f;
  const coverage = fill(t["insights.usual.coverage"], {
    enough: c.enough,
    members: c.members,
    min: USUAL_MIN_READINGS,
  });
  const top = busiestHours(c.byHour);
  const first = top[0];
  if (c.enough === 0 || !first)
    return { based: [t["insights.usual.none"], coverage], details: null };
  const hours = new Intl.ListFormat(language, { type: "conjunction" }).format(top.map(bandText));
  return {
    based: [
      fill(t["insights.usual.top"], { hours, count: first.n, enough: c.enough }),
      coverage,
      t["insights.usual.bias"],
    ],
    details: {
      legend: fill(t["insights.usual.legend"], { enough: c.enough }),
      rows: c.byHour.map((n, hour) => ({
        hour,
        st: fill(t["insights.usual.st"], { time: hhmm(hour * 60) }),
        value: String(n),
        share: n / c.enough,
      })),
    },
  };
}

/** The member card's line: the usual hours and their readings, or "not enough readings yet". */
export function usualLine(u: Usual, f: Formats): string {
  const { t } = f;
  return u.band
    ? fill(t["insights.usual.card"], { hours: bandText(u.band), n: u.readings })
    : fill(t["insights.usual.cardNone"], { n: u.readings });
}
