// The catalog posts the tick sends (#713 part C, D159). Called only by lib/posts-tick.ts, the one module
// outside app/(private) that may import this file (eslint.config.mjs), after a tick that opened the database
// anyway (D141), so a post wakes it no extra time. Post 1, "This week in the alliance": on Monday (server
// day), after Sunday's end-of-day read, the week's calendar entries officers marked "Members can see this",
// with their server times, to the channel the officers chose. No person: no caravan seat, no note, no link,
// no roster field (D71, D75). Each workspace's post goes out at most once per period (`claimPostRun`), with
// no mention allowed, split into Discord's 2,000-character messages by the notices' loop (D102), and a forum
// post's title when the channel is a forum. The log carries codes and counts; never the text or the webhook.
// Post 2, "Shield-up reminder": on Friday from 20:30 ST, 3 hours before the Raid Shield check's night read
// (D137), one fixed reminder to put the shield up before the reset, take the squads off the wall and bring
// the troops home. It reads nothing about members: no name, no count, and it works with the check off.
// Post 3, "Welcome new members": every day after the end-of-day read (D72), a welcome naming the members in
// the day's roster who were not in the day before's. Names are public (`member_names`, never raw_json); no
// other roster value, and never anyone who left. Only when both days' rosters were read and fresh, so a
// failed read never makes anyone new; above WELCOME_NAMES_MAX, a count instead of names.
// Post 4, "Weekly members summary": on Monday, like post 1, to the leaders' channel only, how many joined and
// left in the week that just ended and the member count at its last daily update and at the one before it.
// Counts from the rosters' uids only (`member_uids`): no name, no raw_json, no coin, quest or donation value.
// Post 5, "KvK recap": on the KvK's day, once its End read has finished, to the members' channel, thanks and
// the alliance's War turnout from Start to End (the event page's `killsTurnout`) with the KVK_TOP biggest kills
// gains by public name. It reads uid, name and kills of the event's member_snapshots only: no list of the
// rest, no might lost, no raw_json. A stale or failed Start or End, or no kills gained, posts nothing.
import type { AppContext } from "../app-context";
import { layOut, type Placed } from "../calendar-layout";
import { killsGain, killsTurnout } from "../compute";
import type { Db } from "../db";
import type { Env } from "../env";
import { breakLinks, discordCallout } from "../post-callout";
import { KVK_TOP, POST_CATALOG, postPeriod, WELCOME_NAMES_MAX } from "../post-catalog";
import { calendarRows } from "../repo/calendar";
import { freshRosterOfDay, freshUidsBetween, getDailyRead } from "../repo/daily-reads";
import { liveCallout } from "../repo/post-touches";
import { settingsById } from "../repo/workspace-features";
import { claimPostRun, finishPostRun, postsDue, settlePostRun } from "../repo/workspace-posts";
import { recapKills, type RecapMember } from "../repo/workspace-rosters";
import { serverInstant } from "../schedule";
import { CATALOG_POSTS, type CatalogPost } from "../schema-discord";
import { fill } from "../words";
import { resolveFeatures } from "../workspace-features";
import { addDays } from "./calendar-time";
import { calendarDates, stOf, titleOf } from "./calendar-words";
import {
  WORKSPACE_DICTIONARIES,
  WORKSPACE_LANGUAGES,
  type WorkspaceDictionary,
  type WorkspaceLanguage,
} from "./dictionary";
import { noticeChannels } from "./discord-webhooks";
import { compact } from "./insights-format";
import { privateLog } from "./log";
import { discordMessages } from "./notice-formats";
import { postMessages } from "./notice-publish";

export interface PostsDeps {
  env: Pick<
    Env,
    | "SERVER_TZ"
    | "DAILY_ROSTER_AT"
    | "EVENT_WEEKDAY"
    | "SNAPSHOT_AFTER"
    | "WORKSPACE_KEYS_SECRET"
    | "WORKSPACE_DISCORD_WEBHOOKS"
  >;
  fetch: typeof fetch;
  now: () => Date;
  report: AppContext["report"];
}

const languageOf = (code: string): WorkspaceLanguage =>
  (WORKSPACE_LANGUAGES as readonly string[]).includes(code) ? (code as WorkspaceLanguage) : "en";

/** The post's title: the officers' own, else ours in the post's language; a link in it never links. */
export const postTitle = (post: CatalogPost, title: string, t: WorkspaceDictionary) =>
  breakLinks(title.trim() || t[`posts.${post}.defaultTitle`]);

/**
 * The week's text: the Alliance Duel theme first, then each day that has an entry, with each entry's server
 * time and name as the calendar writes it. An officer's own name for an entry links nothing. Only the
 * entries members can see; null when there is none, so an empty week posts nothing.
 */
export function weekText(placed: Placed[], language: WorkspaceLanguage): string | null {
  const t = WORKSPACE_DICTIONARIES[language];
  const shown = placed.filter((p) => p.entry.forMembers);
  if (shown.length === 0) return null;
  const name = (p: Placed) =>
    titleOf({ ...p.entry, title: p.entry.title && breakLinks(p.entry.title) }, t);
  const theme = shown.filter((p) => p.minute === null).map(name);
  const days = [...new Set(shown.filter((p) => p.minute !== null).map((p) => p.day))];
  const blocks = days.map((day) => {
    const lines = shown
      .filter((p) => p.day === day && p.minute !== null)
      .map((p) => `${stOf(p.entry.kind, p.minute as number, t)} · ${name(p)}`);
    return [calendarDates(language).long(day), ...lines].join("\n");
  });
  return [...(theme.length ? [theme.join("\n")] : []), ...blocks].join("\n\n");
}

/** The Monday-to-Sunday week of `monday`, laid out as the calendar shows it. */
async function weekOf(db: Db, workspaceId: number, monday: string) {
  const sunday = addDays(monday, 6);
  const { entries, rows } = await calendarRows(db, workspaceId, monday, monday, sunday);
  return layOut(entries, rows, monday, sunday);
}

/**
 * The welcome's text: the new members by name, joined as the post's language lists them ("Ana, Bo and
 * Cy"), or their count above WELCOME_NAMES_MAX; null when no one is new. A name links nothing.
 */
export function welcomeText(names: string[], language: WorkspaceLanguage): string | null {
  if (names.length === 0) return null;
  const t = WORKSPACE_DICTIONARIES[language];
  if (names.length > WELCOME_NAMES_MAX) return fill(t["posts.welcome.count"], { n: names.length });
  const list = new Intl.ListFormat(language, { type: "conjunction" }).format(names.map(breakLinks));
  return fill(t[names.length === 1 ? "posts.welcome.one" : "posts.welcome.names"], { names: list });
}

/**
 * The weekly members summary's text for the week before `monday` (Monday to Sunday), from the alliance's
 * usable rosters (uids only, oldest first): who joined and left between each roster and the one before it,
 * as Insights' membership flow counts them; the member count at the week's last roster and at the last one
 * before the week (at most 7 days before it). Null when either is missing: nothing to compare.
 */
export function summaryText(
  rosters: { day: string; uids: number[] }[],
  monday: string,
  language: WorkspaceLanguage,
): string | null {
  const start = addDays(monday, -7);
  const base = rosters.filter((r) => r.day < start).at(-1);
  const week = rosters.filter((r) => r.day >= start && r.day < monday);
  const end = week.at(-1);
  if (!base || !end) return null;
  let [joined, left] = [0, 0];
  [base, ...week].forEach((read, i, all) => {
    const prev = all[i - 1];
    if (!prev) return;
    const [was, is] = [new Set(prev.uids), new Set(read.uids)];
    joined += read.uids.filter((uid) => !was.has(uid)).length;
    left += prev.uids.filter((uid) => !is.has(uid)).length;
  });
  const t = WORKSPACE_DICTIONARIES[language];
  const { short } = calendarDates(language);
  return [
    fill(t["posts.summary.week"], { from: short(start), to: short(addDays(monday, -1)) }),
    fill(t["posts.summary.joined"], { n: joined }),
    fill(t["posts.summary.left"], { n: left }),
    fill(t["posts.summary.members"], { day: short(base.day), n: base.uids.length }),
    fill(t["posts.summary.members"], { day: short(end.day), n: end.uids.length }),
    fill(t["posts.summary.reads"], { n: week.length }),
  ].join("\n");
}

/**
 * The KvK recap's text: thanks first, then the alliance's War turnout from Start to End (#271's
 * `killsTurnout`: kills gained by the members in both rosters, how many of them gained kills) and the
 * KVK_TOP biggest kills gains by public name. Nobody else is listed. Null when no member gained kills.
 */
export function kvkText(
  before: readonly RecapMember[],
  after: readonly RecapMember[],
  language: WorkspaceLanguage,
): string | null {
  const turnout = killsTurnout(before, after);
  if (turnout.gainers === 0) return null;
  const t = WORKSPACE_DICTIONARIES[language];
  const was = new Map(before.map((m) => [m.uid, m.kills]));
  const now = new Map(after.map((m) => [m.uid, m]));
  const top = turnout.gainerUids.slice(0, KVK_TOP).map((uid, i) => {
    const m = now.get(uid) as RecapMember;
    const gain = killsGain(was.get(uid) ?? null, m.kills);
    return fill(t["posts.kvk.top"], {
      place: i + 1,
      name: breakLinks(m.name),
      kills: compact(gain, language),
    });
  });
  return [
    t["posts.kvk.thanks"],
    "",
    fill(t["posts.kvk.kills"], { kills: compact(turnout.gained, language) }),
    fill(t["posts.kvk.members"], { n: turnout.gainers, of: turnout.n }),
    "",
    t["posts.kvk.topHeading"],
    ...top,
    "",
    t["posts.kvk.support"],
  ].join("\n");
}

type Due = Awaited<ReturnType<typeof postsDue>>[number];

/**
 * The members in the day's roster who were not in the day before's, by name; undefined until the day's
 * end-of-day read is over and both rosters were read and fresh. Who left is never looked at.
 */
async function joinersOf(db: Db, unionId: number, day: string): Promise<string[] | undefined> {
  const read = await getDailyRead(db, day);
  if (!read || read.status === "running") return undefined;
  const today = await freshRosterOfDay(db, day, unionId);
  const before = today && (await freshRosterOfDay(db, addDays(day, -1), unionId));
  if (!today || !before) return undefined;
  const known = new Set(before.uids);
  return today.names.filter((_, i) => !known.has(today.uids[i] as number));
}

/**
 * Each post's text in the post's language for the period; null when it has nothing to say (settled as
 * `skipped`); undefined when it cannot tell yet (not settled: a later tick of the period looks again). The
 * shield-up reminder is the same words every Friday: no member, count or reading in it. The welcome waits
 * for the day's read and both days' rosters: a read that failed or is still running names no one.
 */
const BODIES: Record<
  CatalogPost,
  (
    db: Db,
    due: Due,
    period: string,
    language: WorkspaceLanguage,
    cfg: PostsDeps["env"],
  ) => Promise<string | null | undefined>
> = {
  week: async (db, due, period, language) =>
    weekText(await weekOf(db, due.workspaceId, period), language),
  shield_up: async (_db, _due, _period, language) =>
    WORKSPACE_DICTIONARIES[language]["posts.shield_up.body"],
  welcome: async (db, due, period, language) => {
    const joiners = await joinersOf(db, due.unionId, period);
    return joiners && welcomeText(joiners, language);
  },
  summary: async (db, due, period, language) =>
    summaryText(
      await freshUidsBetween(db, due.unionId, addDays(period, -14), addDays(period, -1)),
      period,
      language,
    ),
  kvk: async (db, due, period, language, cfg) => {
    const from = serverInstant(period, "00:00", cfg);
    const kills = await recapKills(
      db,
      due.unionId,
      from,
      serverInstant(addDays(period, 1), "00:00", cfg),
    );
    return kills && kvkText(kills.before, kills.after, language);
  },
};

/**
 * One workspace's post: built in full, then claimed, sent, and its outcome kept. A week with no entry for
 * members is settled as `skipped`, so the later ticks of that Monday stop at the one query that lists the
 * posts due (review of PR 761). A post the owner does not allow (one read) or a channel with no usable webhook
 * (two) is not settled: the owner may allow it, or an officer paste the webhook, later that day.
 */
async function sendPost(db: Db, deps: PostsDeps, due: Due, period: string, post: CatalogPost) {
  const run = { workspaceId: due.workspaceId, post, period };
  const found = await settingsById(db, due.workspaceId);
  // The owner's layer (D134): a post the owner does not allow is never sent, whatever its switch says.
  if (!found || !resolveFeatures(found.settings, []).on.has(POST_CATALOG[post].feature)) return;
  const ws = { workspaceId: due.workspaceId, slug: due.slug };
  const channel = (await noticeChannels(db, ws, deps))[due.channel];
  if (!channel) return;
  const language = languageOf(due.language);
  const text = await BODIES[post](db, due, period, language, deps.env);
  if (text === undefined) return;
  if (text === null) return settlePostRun(db, { ...run, at: deps.now() });
  const title = postTitle(post, due.title, WORKSPACE_DICTIONARIES[language]);
  // D156: the alliance's own line above our title, while its `post_callouts` is on.
  const lead = discordCallout(await liveCallout(db, due.workspaceId, post));
  const messages = discordMessages(title, [{ name: "", text }], !channel.forum, lead);
  // The claim comes last: nothing that can throw stands between it and the send (review of PR 761).
  if (!(await claimPostRun(db, { ...run, at: deps.now() }))) return;
  const { sent, status } = await postMessages(deps.fetch, channel, title, messages);
  const done = sent === messages.length;
  // No answer at all (a timeout) may still have posted: never tried again, so the week is never doubled.
  const outcome = done ? "posted" : status === null ? "unanswered" : "failed";
  await finishPostRun(db, run, { status: outcome, sent });
  privateLog(done ? `posts.${post}.sent` : `posts.${post}.failed`, {
    sent,
    of: messages.length,
    http: status ?? 0,
  });
}

/**
 * A workspace's send starts only while this long is left before the deadline: the notices' loop gives all
 * the messages of one post at most 40 s, plus its reads and writes.
 */
export const POST_START_MS = 45_000;

/**
 * Every catalog post due now, for every workspace that has it on, until `deadline` (epoch ms, the tick's
 * budget): no workspace starts once less than POST_START_MS is left, and the rest wait for the next tick.
 * Nothing is read when no post is due today (the clock first); one workspace that fails never stops the
 * others, and its error leaves as a code.
 */
export async function sendDuePosts(db: Db, deps: PostsDeps, deadline: number): Promise<void> {
  const now = deps.now();
  for (const post of CATALOG_POSTS) {
    const period = postPeriod(post, now, deps.env);
    if (period === null) continue;
    for (const due of await postsDue(db, post, period)) {
      if (Date.now() + POST_START_MS > deadline) {
        privateLog(`posts.${post}.deadline`);
        return;
      }
      await sendPost(db, deps, due, period, post).catch((error: unknown) => {
        privateLog(`posts.${post}.error`);
        deps.report(error, { route: "lib/private/catalog-posts.ts", kind: "w.posts.send_failed" });
      });
    }
  }
}
