// Raid prep's page data in the officer's words (issue 474, D137), made on the server: each row's tracker
// line ("Tracker: shield seen · map seen 22:32 ST"), the reads' counts above the rows, and who "Accept the
// tracker's" would mark. Times are on the server clock here; the officer's own clock is added in the
// browser (Times, D101). People first (D75): no reading is no line, never a ✗.
import { fill } from "@/lib/copy";
import { dayIn, hhmm } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { MessageLanguage, PrepView, TrackerHint } from "@/lib/private/raid-prep";

export interface PrepTrackerView {
  /** "Tracker: shield seen" or "Tracker: no shield seen yet". */
  text: string;
  on: boolean;
  /** "map seen 22:32 ST" and its instant, for the officer's clock beside it. */
  map: { st: string; at: number; day: string } | null;
  /** "8 h shield, ends by 06:32 ST at the latest", or "shield on, length unknown". */
  detail: string | null;
  mayEnd: string | null;
  lost: string | null;
}

export interface PrepRowView {
  tracker: PrepTrackerView | null;
  /** Where the row goes among the not-set ones: not seen first, then may end before KvK, no reading, seen. */
  rank: number;
  wall: { mark: "yes" | "no" | null; version: number };
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
  const on = h.suggestion === "on";
  const detail = !on
    ? null
    : h.endsBy !== null
      ? fill(t["roll.prep.endsBy"], { time: st(h.endsBy) })
      : t["roll.prep.otherKind"];
  return {
    text: t[on ? "roll.prep.on" : "roll.prep.notSeen"],
    on,
    map:
      h.mapAt === null
        ? null
        : {
            st: fill(t["roll.prep.map"], { time: st(h.mapAt) }),
            at: h.mapAt,
            day: dayIn(zone, h.mapAt),
          },
    detail,
    mayEnd: h.mayEndBeforeKvk ? t["roll.prep.mayEnd"] : null,
    lost: h.lost
      ? fill(t["roll.prep.lost"], { night: st(h.lost.night), morning: st(h.lost.morning) })
      : null,
  };
}

const rankOf = (h: TrackerHint | null) => {
  if (!h) return 2;
  if (h.suggestion === "not_seen") return 0;
  return h.mayEndBeforeKvk ? 1 : 3;
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
        language: r.language,
        languageName: t[`roll.prep.lang.${r.language}`],
      },
    ]),
  );
}

export function prepHead(view: PrepView, t: WorkspaceDictionary): PrepHeadView {
  const seen = [...view.rows].filter(([, r]) => r.tracker?.suggestion === "on").map(([uid]) => uid);
  if (!view.tracker) return { lines: [], hint: null, seen: [], when: view.when };
  const line = (key: "roll.prep.read.night" | "roll.prep.read.morning", c: PrepView["night"]) => {
    if (!c) return [];
    const text = fill(t[key], { on: c.on, read: c.read });
    const unread = view.members - c.read;
    return [unread > 0 ? `${text} · ${fill(t["roll.prep.read.unread"], { n: unread })}` : text];
  };
  const rows = [...view.rows.values()];
  const notSeen = rows.filter((r) => r.tracker?.suggestion === "not_seen").length;
  const mayEnd = rows.filter((r) => r.tracker?.mayEndBeforeKvk).length;
  const reads = view.night || view.morning;
  const lines = [
    ...(reads ? [fill(t["roll.prep.attention"], { n: notSeen, m: mayEnd })] : []),
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
  };
}
