// Raid prep's page data in the officer's words (issue 474, D137), made on the server: each row's tracker
// checkpoints, one line each with its map scan's time ("Night check: shield seen (map from 22:33 ST)",
// issue 585), the answer
// above the rows ("Shields for this raid: 86 of 97 seen at the morning check (10:04 ST)", first glance),
// the Discord summary's state, who "Mark ✓ the n seen with a shield" would mark, and
// the tick's marks still to check. Times are server time. People first (D75): no reading is no line. A seen
// shield's length is never shown: the tracker does not give it. Each map says its day and its age against
// the reset ("map Fri 22:33 ST · 1 h 27 min before reset"), and "Check by hand: n" lists the members whose
// map nearest the reset does not vouch for 00:00 ST (issue 726).
import { dateWords } from "@/lib/date-words";
import { hhmm } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type {
  HandReason,
  MessageLanguage,
  PrepView,
  SummaryState,
  TrackerHint,
} from "@/lib/private/raid-prep";
import { fill } from "@/lib/words";

export interface PrepTrackerView {
  /** The newest reading saw a shield. */
  on: boolean;
  /**
   * The checkpoints that happened: "Night check: shield seen" with "map from 22:33 ST", then "Morning
   * check: no shield seen" with its own scan. The time is the member's map scan, never the check's.
   */
  checks: { text: string; scan: string; age: string; on: boolean }[];
}

export interface PrepRowView {
  tracker: PrepTrackerView | null;
  /** Where the row goes among the not-set ones: not seen first, then no reading, then seen. */
  rank: number;
  /** Why to check this member by hand (issue 726), in words: "Check by hand · no reading"; else null. */
  hand: string | null;
  wall: { mark: "yes" | "no" | null; version: number };
  /** The Shield ✓ is the tick's, from the tracker's reading; `unchecked` until an officer checked it. */
  fromTracker: { unchecked: boolean } | null;
  language: MessageLanguage;
  languageName: string;
}

export interface PrepHeadView {
  /**
   * The answer first ("Shields for this raid: 86 of 97 seen at the morning check (10:04 ST) · 3 not read
   * yet"); null while the check is off. `next`: the check still to come before KvK, when there is one.
   */
  answer: string | null;
  next: string | null;
  hint: string | null;
  /** Members the newest reading saw with a shield: "Mark ✓ the n seen" marks those not set yet. */
  seen: number[];
  /** "Check by hand: n" (issue 726): its members as the page was read; null before any reading. */
  hand: number[] | null;
  /** An officer has marked or pressed Checked: until then the grid never says "Nobody left to mark". */
  looked: boolean;
  when: "reset" | "kvk";
  /** The newest tracker mark still to check: "23:31 ST" for the notice, and its instant for Checked. */
  check: { st: string; at: number } | null;
  /** The Discord summary's state in words; `settings` links Alliance settings (not set up, failed). */
  discord: { text: string; settings: boolean } | null;
}

/** "22:33": the server's clock. */
const clockOf = (zone: string) => (at: number) => dateWords("en", zone).time(new Date(at));

/** "1 h 27 min", "2 h", "45 min": the same units in English, Portuguese and French. */
function span(minutes: number) {
  const [h, m] = [Math.floor(minutes / 60), minutes % 60];
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * A map's age against the reset (epoch ms): "1 h 27 min before reset", "31 min after reset". Counted from
 * the map's minute, so it agrees with the time beside it.
 */
function ageOf(at: number, reset: number, t: WorkspaceDictionary) {
  const minutes = Math.round((at - (at % 60_000) - reset) / 60_000);
  if (minutes === 0) return t["roll.prep.age.at"];
  const key = minutes < 0 ? "roll.prep.age.before" : "roll.prep.age.after";
  return fill(t[key], { age: span(Math.abs(minutes)) });
}

/** The page's words and clocks: the server's time, and the weekday in the officer's language. */
interface Said {
  t: WorkspaceDictionary;
  zone: string;
  language: string;
}

function trackerView(h: TrackerHint, said: Said, reset: number): PrepTrackerView {
  const { t, zone } = said;
  const clock = clockOf(zone);
  const { weekday } = dateWords(said.language, zone);
  return {
    on: h.suggestion === "on",
    checks: h.checkpoints.map((c) => ({
      text: fill(t["roll.prep.checkpoint"], {
        pass: t[`roll.prep.pass.${c.pass}`],
        state: t[c.on ? "roll.prep.on" : "roll.prep.notSeen"],
      }),
      // The day too: a Thursday map must never read like Friday's (issue 726).
      scan: fill(t["roll.prep.map"], { day: weekday(new Date(c.at)), time: clock(c.at) }),
      age: ageOf(c.at, reset, t),
      on: c.on,
    })),
  };
}

const handWords = (reason: HandReason | null, t: WorkspaceDictionary) =>
  reason === null ? null : t[`roll.prep.hand.${reason}`];

const rankOf = (h: TrackerHint | null) => {
  if (!h) return 2;
  return h.suggestion === "not_seen" ? 0 : 3;
};

export function prepRows(
  view: PrepView,
  t: WorkspaceDictionary,
  zone: string,
  language: string,
): Record<number, PrepRowView> {
  const said = { t, zone, language };
  return Object.fromEntries(
    [...view.rows].map(([uid, r]) => [
      uid,
      {
        tracker: r.tracker && trackerView(r.tracker, said, view.reset),
        // The members to check by hand open first among the not set (panel review, issue 726).
        rank: r.hand === null ? rankOf(r.tracker) : 0,
        hand: handWords(r.hand, t),
        wall: { mark: r.wall.mark as "yes" | "no" | null, version: r.wall.version },
        fromTracker: r.fromTracker,
        language: r.language,
        languageName: t[`roll.prep.lang.${r.language}`],
      },
    ]),
  );
}

/** The summary's state in words: posted (with its last update), waiting, not set up, failed or deleted. */
function discordLine(s: SummaryState, t: WorkspaceDictionary, zone: string) {
  if (s.state === "posted")
    return {
      text: fill(t["roll.prep.discord.posted"], { time: clockOf(zone)(s.at) }),
      settings: false,
    };
  return {
    text: t[`roll.prep.discord.${s.state}`],
    settings: s.state === "off" || s.state === "unset" || s.state === "failed",
  };
}

/**
 * The answer from the newest check, the morning's over the night's (issue 585, first glance), then the
 * check still to come before KvK. Before either: when each runs; a past week with none: "no reading".
 */
function answerOf(view: PrepView, t: WorkspaceDictionary, zone: string) {
  const morningAt = hhmm(view.morningMinute);
  const newest = view.morning
    ? { key: "roll.prep.status.morning" as const, c: view.morning }
    : view.night && { key: "roll.prep.status.night" as const, c: view.night };
  if (!newest)
    return view.ahead
      ? {
          answer: t["roll.prep.status.none"],
          next: fill(t["roll.prep.read.none"], {
            night: hhmm(view.nightMinute),
            time: morningAt,
          }),
        }
      : { answer: t["roll.prep.status.noRead"], next: null };
  const { c } = newest;
  const text = fill(t[newest.key], {
    time: c.at === null ? "" : clockOf(zone)(c.at),
    on: c.on,
    read: c.read,
  });
  const unread = view.members - c.read;
  return {
    answer: unread > 0 ? `${text} · ${fill(t["roll.prep.read.unread"], { n: unread })}` : text,
    next:
      view.morning || !view.ahead ? null : fill(t["roll.prep.next.morning"], { time: morningAt }),
  };
}

/** Above the rows: the answer first (issue 585, first glance), then the summary's state. */
export function prepHead(view: PrepView, t: WorkspaceDictionary, zone: string): PrepHeadView {
  const seen = [...view.rows].filter(([, r]) => r.tracker?.suggestion === "on").map(([uid]) => uid);
  const at = view.toCheckAt;
  const check = at === null ? null : { st: `${clockOf(zone)(at)} ST`, at };
  if (!view.tracker)
    return {
      answer: null,
      next: null,
      hint: null,
      seen: [],
      hand: null,
      looked: view.looked,
      when: view.when,
      check,
      discord: null,
    };
  return {
    ...answerOf(view, t, zone),
    hint: t["roll.prep.hint"],
    seen,
    hand: view.handCheck,
    looked: view.looked,
    when: view.when,
    check,
    discord: view.summary && discordLine(view.summary, t, zone),
  };
}
