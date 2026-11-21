// Raid prep's page data in the officer's words (issue 474, D137), made on the server: each row's tracker
// checkpoints on one line ("Night 22:33: seen · Morning 07:15: not seen", issue 585), the newest check's
// count above the rows, the Discord summary's state, who "Mark ✓ the n seen with a shield" would mark, and
// the tick's marks still to check. Times are server time. People first (D75): no reading is no line. A seen
// shield's length is never shown: the tracker does not give it.
import { fill } from "@/lib/copy";
import { hhmm } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { MessageLanguage, PrepView, SummaryState, TrackerHint } from "@/lib/private/raid-prep";

export interface PrepTrackerView {
  /** The newest reading saw a shield. */
  on: boolean;
  /** "Night 22:33: seen", then "Morning 07:15: not seen": the checkpoints that happened, one line. */
  checks: { text: string; on: boolean }[];
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
  /** The newest check's line ("Morning check 10:04 ST: 86 of 97 with a shield seen · 3 not read yet"). */
  lines: string[];
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
const clockOf = (zone: string) => {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (at: number) => f.format(at);
};

function trackerView(h: TrackerHint, t: WorkspaceDictionary, zone: string): PrepTrackerView {
  const clock = clockOf(zone);
  return {
    on: h.suggestion === "on",
    checks: h.checkpoints.map((c) => ({
      text: fill(t["roll.prep.checkpoint"], {
        pass: t[`roll.prep.pass.${c.pass}`],
        time: clock(c.at),
        state: t[c.on ? "roll.prep.on" : "roll.prep.notSeen"],
      }),
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

/** Above the rows: the newest check only, at most three counts (issue 585), then the summary's state. */
export function prepHead(view: PrepView, t: WorkspaceDictionary, zone: string): PrepHeadView {
  const seen = [...view.rows].filter(([, r]) => r.tracker?.suggestion === "on").map(([uid]) => uid);
  const at = view.toCheckAt;
  const clock = clockOf(zone);
  const check = at === null ? null : { st: `${clock(at)} ST`, at };
  if (!view.tracker)
    return { lines: [], hint: null, seen: [], when: view.when, check, discord: null };
  const newest = view.morning
    ? { key: "roll.prep.read.morning" as const, c: view.morning }
    : view.night && { key: "roll.prep.read.night" as const, c: view.night };
  const line = (n: NonNullable<typeof newest>) => {
    const text = fill(t[n.key], {
      time: n.c.at === null ? "" : clock(n.c.at),
      on: n.c.on,
      read: n.c.read,
    });
    const unread = view.members - n.c.read;
    return unread > 0 ? `${text} · ${fill(t["roll.prep.read.unread"], { n: unread })}` : text;
  };
  return {
    lines: [
      newest ? line(newest) : fill(t["roll.prep.read.none"], { time: hhmm(view.morningMinute) }),
    ],
    hint: t["roll.prep.hint"],
    seen,
    when: view.when,
    check,
    discord: view.summary && discordLine(view.summary, t, zone),
  };
}
