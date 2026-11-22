// One way to write a date and a time on the desk, the members' board and Me (issue 585 batch 4, F35): each
// form has one purpose, made once per language and zone. A "YYYY-MM-DD" string is a server day (written as
// that calendar date); a Date is an instant, written on `zone`'s clock (the server's, ST). The line adds
// " ST" through its dictionary. PT and FR short months end in "." ("nov."), so a date that ends a sentence
// or follows an article uses `sentence` or `withYear`, never `day` ("nov.." and "le ven. 20 nov.").

type When = string | Date;

/** How a date and its time are joined: "Fri, Nov 20, 18:54", "sex., 20 de nov. às 18:54", "ven. 20 nov. à 18:54". */
const JOINS: Record<string, string> = { "pt-BR": " às ", fr: " à " };
export const joinAt = (language: string, day: string, time: string) =>
  `${day}${JOINS[language] ?? ", "}${time}`;

export interface DateWords {
  /** "Fri, Nov 20": every date in a row, chip, line or card. */
  day: (at: When) => string;
  /** "Nov 20", kept on one line (no-break spaces): where the weekday is said already. */
  dayMonth: (at: When) => string;
  /** "Friday, November 20": a day's heading. */
  long: (at: When) => string;
  /** "November 20": a date that ends a sentence or follows an article. */
  sentence: (at: When) => string;
  /** "November 20, 2026": a date that may be months away. */
  withYear: (at: When) => string;
  /** "18:54", on the 24-hour clock. */
  time: (at: Date) => string;
  /** "Fri, Nov 20, 18:54". */
  at: (at: Date) => string;
  /** "Nov 16 – 22": a week, both months named when it crosses one. */
  range: (from: When, to: When) => string;
}

function make(language: string, zone: string): DateWords {
  const format = (options: Intl.DateTimeFormatOptions, timeZone: string) =>
    new Intl.DateTimeFormat(language, { ...options, timeZone });
  const both = (options: Intl.DateTimeFormatOptions) => {
    const [days, instants] = [format(options, "UTC"), format(options, zone)];
    const of = (at: When) =>
      typeof at === "string"
        ? ([days, new Date(`${at}T00:00:00Z`)] as const)
        : ([instants, at] as const);
    return {
      format: (at: When) => {
        const [f, d] = of(at);
        return f.format(d);
      },
      range: (from: When, to: When) => {
        const [f, a] = of(from);
        return f.formatRange(a, of(to)[1]);
      },
    };
  };
  const day = both({ weekday: "short", day: "numeric", month: "short" });
  const dayMonth = both({ day: "numeric", month: "short" });
  const long = both({ weekday: "long", day: "numeric", month: "long" });
  const sentence = both({ day: "numeric", month: "long" });
  const withYear = both({ day: "numeric", month: "long", year: "numeric" });
  const clock = format({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, zone);
  return {
    day: day.format,
    dayMonth: (at) => dayMonth.format(at).replace(/ /g, " "),
    long: long.format,
    sentence: sentence.format,
    withYear: withYear.format,
    time: (at) => clock.format(at),
    at: (at) => joinAt(language, day.format(at), clock.format(at)),
    range: dayMonth.range,
  };
}

const MADE = new Map<string, DateWords>();

/** The date forms in `language`, instants on `zone`'s clock; made once per language and zone. */
export function dateWords(language: string, zone: string): DateWords {
  const key = `${language}|${zone}`;
  let words = MADE.get(key);
  if (!words) {
    words = make(language, zone);
    MADE.set(key, words);
  }
  return words;
}
