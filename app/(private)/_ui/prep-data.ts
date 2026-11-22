// Raid prep's page data in the officer's words (issue 474, D137), made on the server: each row's tracker
// checkpoints, one line each with its map scan's time ("Night check: shield seen (map from 22:33 ST)",
// issue 585), the answer
// above the rows ("Shields for this raid: 86 of 97 seen at the morning check (10:04 ST)", first glance),
// the Discord summary's state, who "Mark ✓ the n seen with a shield" would mark, and
// the tick's marks still to check. Times are server time. People first (D75): no reading is no line. A seen
// shield's length is never shown: the tracker does not give it.
import { dateWords } from "@/lib/date-words";
import { hhmm } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { MessageLanguage, PrepView, SummaryState, TrackerHint } from "@/lib/private/raid-prep";
import { fill } from "@/lib/words";

export interface PrepTrackerView {
  /** The newest reading saw a shield. */
  on: boolean;
  /**
   * The checkpoints that happened: "Night check: shield seen" with "map from 22:33 ST", then "Morning
   * check: no shield seen" with its own scan. The time is the member's map scan, never the check's.
   */
  checks: { text: string; scan: string; on: boolean }[];
}

export interface PrepRowView {
  tracker: PrepTrackerView | null;
  /** Where the row goes among the not-set ones: not seen first, then no reading, then seen. */
  rank: number;
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
  when: "reset" | "kvk";
  /** The newest tracker mark still to check: "23:31 ST" for the notice, and its instant for Checked. */
  check: { st: string; at: number } | null;
  /** The Discord summary's state in words; `settings` links Alliance settings (not set up, failed). */
  discord: { text: string; settings: boolean } | null;
}

/** "22:33": the server's clock. */
const clockOf = (zone: string) => (at: number) => dateWords("en", zone).time(new Date(at));

function trackerView(h: TrackerHint, t: WorkspaceDictionary, zone: string): PrepTrackerView {
  const clock = clockOf(zone);
  return {
    on: h.suggestion === "on",
    checks: h.checkpoints.map((c) => ({
      text: fill(t["roll.prep.checkpoint"], {
        pass: t[`roll.prep.pass.${c.pass}`],
        state: t[c.on ? "roll.prep.on" : "roll.prep.notSeen"],
      }),
      scan: fill(t["roll.prep.scan"], { time: clock(c.at) }),
      on: c.on,
    })),
  };
}

const rankOf = (h: TrackerHint | null) => {
  if (!h) return 2;
  return h.suggestion === "not_seen" ? 0 : 3;
};

export function prepRows(
  view: PrepView,
  t: WorkspaceDictionary,
  zone: string,
): Record<number, PrepRowView> {
  return Object.fromEntries(
    [...view.rows].map(([uid, r]) => [
      uid,
      {
        tracker: r.tracker && trackerView(r.tracker, t, zone),
        rank: rankOf(r.tracker),
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
          next: fill(t["roll.prep.read.none"], { time: morningAt }),
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
      when: view.when,
      check,
      discord: null,
    };
  return {
    ...answerOf(view, t, zone),
    hint: t["roll.prep.hint"],
    seen,
    when: view.when,
    check,
    discord: view.summary && discordLine(view.summary, t, zone),
  };
}
