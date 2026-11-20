// The desk's read status bar (D135, issue 478): what the tracker reads of this alliance are doing now, as
// lines in the officer's language. Counts and server times only: no uid, name or value (D71). The workspace
// comes from the session (`access`), so a workspace sees only its own reads. Each line shows only when there
// is something to say:
// - the tracker key needs to be entered again (D124 `invalid` or `reenter`), with a link to Alliance settings;
// - today's roster read failed, or is not in after its window closed: the cards keep the last numbers;
// - the squads read (D132), while its feature is on and a key reads it (`squadsReader`): running, paused,
//   done (for 30 minutes), stopped or skipped (until the quota day ends).
import { fill } from "../copy";
import type { Db } from "../db";
import type { Env } from "../env";
import { getDailyRead } from "../repo/daily-reads";
import { dayRosterState } from "../repo/squads";
import { inEventWindow, quotaDayRead, serverInstant } from "../schedule";
import { stopKind } from "../squads";
import type { WorkspaceAccess } from "./access";
import type { WorkspaceDictionary } from "./dictionary";
import { squadsReader, squadsToday, type SquadsToday } from "./squads-today";
import { trackerKeyView } from "./tracker-key";

/** A finished read's line stays this long after it ended (issue 478). */
export const DONE_SHOWN_MS = 30 * 60_000;

export interface StatusLine {
  id: "key" | "roster" | "squads";
  text: string;
  /** progress: under way (a pulse dot); quiet: done or paused; attention: stopped, failed or a key to fix. */
  tone: "progress" | "quiet" | "attention";
  /** The line asks for Alliance settings. */
  settings?: true;
  /** Home's key card says the same (a refused, spent or unreadable key): a page that shows it leaves it out. */
  keyCard?: true;
  /** When the line goes (ms): a finished read's, 30 minutes after it ended. */
  until?: number;
}

export interface ReadStatus {
  /** The key's line first, then the others newest first. Empty: the bar is hidden. */
  lines: StatusLine[];
  /** A read is under way: the bar polls while this holds and the tab is visible. */
  running: boolean;
}

/** "02:15" on the server's clock. */
export const serverClock = (timeZone: string, at: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(at);

/** A line and the time it sorts by: when its read started or ended. */
type Dated = { at: number; line: StatusLine };

export async function readStatus(
  db: Db,
  access: WorkspaceAccess,
  env: Env,
  now: Date,
  t: WorkspaceDictionary,
): Promise<ReadStatus> {
  const day = quotaDayRead(now, env);
  const [key, reader, roster, daily] = await Promise.all([
    trackerKeyView(db, access, env, now),
    squadsReader(db, access, env),
    dayRosterState(db, day, access.unionId),
    getDailyRead(db, day),
  ]);
  const squads = reader ? await squadsToday(db, access, env, now, reader) : null;
  // The states Home's key card asks the officers to fix (KeyCard.tsx).
  const card = key.state === "invalid" || key.state === "out_of_quota" || key.state === "reenter";
  const w = { env, now, t, card };
  const keyLine = (state: "invalid" | "reenter"): Dated => ({
    at: Infinity,
    line: {
      id: "key",
      text: t[`status.key.${state}`],
      tone: "attention",
      settings: true,
      keyCard: true,
    },
  });
  const dated = [
    key.state === "invalid" || key.state === "reenter" ? keyLine(key.state) : null,
    rosterLine(day, roster, daily?.status === "running", reader !== null, w),
    squads?.day ? squadsLine(squads, squads.day, w) : null,
  ].filter((d): d is Dated => d !== null);
  const lines = dated.sort((a, b) => b.at - a.at).map((d) => d.line);
  return { lines, running: lines.some((l) => l.tone === "progress") };
}

type Words = { env: Env; now: Date; t: WorkspaceDictionary; card: boolean };

/**
 * Today's roster read, when it failed, or is late: the day's read is not running and its window closed
 * without this alliance's roster. The squads wait for it when they are read.
 */
function rosterLine(
  day: string,
  roster: "ok" | "failed" | null,
  dailyRunning: boolean,
  squads: boolean,
  { env, now, t }: Words,
): Dated | null {
  const readAt = serverInstant(day, env.DAILY_ROSTER_AT, env).getTime();
  const closed = now.getTime() >= readAt + env.SNAPSHOT_WINDOW_MIN * 60_000;
  const late = roster === null && closed && !dailyRunning;
  if (roster !== "failed" && !late) return null;
  const said = t[roster === "failed" ? "status.roster.failed" : "status.roster.late"];
  const text = squads ? `${said} · ${t["status.roster.squadsWait"]}` : said;
  return { at: readAt, line: { id: "roster", text, tone: "attention" } };
}
type Day = NonNullable<SquadsToday["day"]>;

/** The squads read's line, or null when it was done over 30 minutes ago. */
function squadsLine(s: SquadsToday, day: Day, w: Words): Dated | null {
  const at = (day.finishedAt ?? day.startedAt).getTime();
  const said = (tone: StatusLine["tone"], text: string, until?: number): Dated => ({
    at,
    line: { id: "squads", text, tone, ...(until && { until }) },
  });
  if (day.status === "skipped" || day.status === "stopped") {
    const over = said("attention", overText(s, day, w));
    if (onKeyCard(s, day, w)) over.line.keyCard = true;
    return over;
  }
  const { t } = w;
  const counts = { read: s.read, members: s.members };
  const clock = (d: Date) => serverClock(w.env.SERVER_TZ, d);
  if (day.status === "done") {
    const until = at + DONE_SHOWN_MS;
    if (w.now.getTime() >= until) return null;
    const words = { ...counts, at: clock(new Date(at)), failed: s.failed };
    const key = s.failed ? "status.squads.doneMissed" : "status.squads.done";
    return said("quiet", fill(t[key], words), until);
  }
  const paused = pausedWhy(s, day, w);
  if (paused) return said("quiet", fill(t[paused], counts));
  // Everyone left waits for a later try.
  if (s.nextAt && s.dueNow === 0) {
    const words = { ...counts, retrying: s.retrying, at: clock(s.nextAt) };
    return said("progress", fill(t["status.squads.waiting"], words));
  }
  return said(
    "progress",
    fill(t["status.squads.running"], { ...counts, at: clock(day.startedAt) }),
  );
}

/**
 * Why a running day waits: on the site's key nothing runs in the event window (D132), and `quota` waits
 * for the reserve. Null: it is reading.
 */
function pausedWhy(s: SquadsToday, day: Day, w: Words) {
  if (s.key === "site" && inEventWindow(w.now, w.env)) return "status.squads.pausedEvent" as const;
  return day.reason === "quota" ? ("status.squads.pausedMargin" as const) : null;
}

/** A day the tracker refused or spent the alliance's own key: Home's key card says it too. */
function onKeyCard(s: SquadsToday, day: Day, w: Words): boolean {
  const kind = stopKind(day.reason);
  return w.card && s.key === "own" && (kind === "key" || kind === "limit");
}

/** Why a skipped or stopped day reads nobody more: D132's `stopKind` words, or the limit's reset time. */
function overText(s: SquadsToday, day: Day, { env, now, t }: Words): string {
  const kind = stopKind(day.reason);
  const why = kind ? t[`squads.stop.${kind}`] : t["status.why.other"];
  if (day.status === "skipped") {
    const what = day.reason === "quota_unknown" ? t["status.why.quotaUnknown"] : why;
    return fill(t["status.squads.skipped"], { why: what });
  }
  const counts = { read: s.read, members: s.members };
  if (kind !== "limit") return fill(t["status.squads.stopped"], { ...counts, why });
  // The quota resets at the next 00:00 UTC.
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return fill(t["status.squads.limit"], { ...counts, at: serverClock(env.SERVER_TZ, reset) });
}
