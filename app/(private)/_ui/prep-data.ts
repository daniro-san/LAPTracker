// Raid prep's page data in the officer's words (issue 474, D137), made on the server: each row's tracker
// checkpoints ("Night · 22:33 ST: shield seen", "Morning · 07:15 ST: no shield seen", D137 2026-11-21), the
// reads' counts above the rows, who "Accept the tracker's" would mark, and the tick's marks still to check.
// Times are server time, one short line per checkpoint. People first (D75): no reading is no line. A seen
// shield's length is never shown: the tracker does not give it.
import { fill } from "@/lib/copy";
import { hhmm } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { MessageLanguage, PrepView, TrackerHint } from "@/lib/private/raid-prep";

export interface PrepTrackerView {
  /** The newest reading saw a shield. */
  on: boolean;
  /** "Night · 22:33 ST: shield seen", then "Morning · 07:15 ST: no shield seen": the checkpoints that happened. */
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
  /** "Friday's read: 87 of 98 with a shield seen · 3 not read yet", then Saturday's. */
  lines: string[];
  hint: string | null;
  /** Members the newest reading saw with a shield: "Accept the tracker's" marks those not set yet. */
  seen: number[];
  when: "reset" | "kvk";
  /** The newest tracker mark still to check: "23:31 ST" for the notice, and its instant for Checked. */
  check: { st: string; at: number } | null;
}

const stClock = (zone: string) => {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (at: number) => `${f.format(at)} ST`;
};

function trackerView(h: TrackerHint, t: WorkspaceDictionary, zone: string): PrepTrackerView {
  const st = stClock(zone);
  return {
    on: h.suggestion === "on",
    checks: h.checkpoints.map((c) => ({
      text: fill(t["roll.prep.checkpoint"], {
        pass: t[`roll.prep.pass.${c.pass}`],
        time: st(c.at),
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

export function prepHead(view: PrepView, t: WorkspaceDictionary, zone: string): PrepHeadView {
  const seen = [...view.rows].filter(([, r]) => r.tracker?.suggestion === "on").map(([uid]) => uid);
  const at = view.toCheckAt;
  const check = at === null ? null : { st: stClock(zone)(at), at };
  if (!view.tracker) return { lines: [], hint: null, seen: [], when: view.when, check };
  const line = (key: "roll.prep.read.night" | "roll.prep.read.morning", c: PrepView["night"]) => {
    if (!c) return [];
    const text = fill(t[key], { on: c.on, read: c.read });
    const unread = view.members - c.read;
    return [unread > 0 ? `${text} · ${fill(t["roll.prep.read.unread"], { n: unread })}` : text];
  };
  const rows = [...view.rows.values()];
  const notSeen = rows.filter((r) => r.tracker?.suggestion === "not_seen").length;
  const reads = view.night || view.morning;
  const lines = [
    ...(reads ? [fill(t["roll.prep.attention"], { n: notSeen })] : []),
    ...line("roll.prep.read.night", view.night),
    ...line("roll.prep.read.morning", view.morning),
  ];
  return {
    lines: lines.length
      ? lines
      : [fill(t["roll.prep.read.none"], { time: hhmm(view.morningMinute) })],
    hint: t["roll.prep.hint"],
    seen,
    when: view.when,
    check,
  };
}
