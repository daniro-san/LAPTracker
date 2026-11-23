// The catalog posts the tick sends (#713 part C, D159). Called only by lib/posts-tick.ts, the one module
// outside app/(private) that may import this file (eslint.config.mjs), after a tick that opened the database
// anyway (D141), so a post wakes it no extra time. Post 1, "This week in the alliance": on Monday (server
// day), after Sunday's end-of-day read, the week's calendar entries officers marked "Members can see this",
// with their server times, to the channel the officers chose. No person: no caravan seat, no note, no link,
// no roster field (D71, D75). Each workspace's post goes out at most once per period (`claimPostRun`), with
// no mention allowed, split into Discord's 2,000-character messages by the notices' loop (D102), and a forum
// post's title when the channel is a forum. The log carries codes and counts; never the text or the webhook.
import type { AppContext } from "../app-context";
import { layOut, type Placed } from "../calendar-layout";
import type { Db } from "../db";
import type { Env } from "../env";
import { breakLinks, discordCallout } from "../post-callout";
import { POST_CATALOG, postPeriod } from "../post-catalog";
import { calendarRows } from "../repo/calendar";
import { liveCallout } from "../repo/post-touches";
import { settingsById } from "../repo/workspace-features";
import { claimPostRun, finishPostRun, postsDue } from "../repo/workspace-posts";
import type { CatalogPost } from "../schema-discord";
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
import { privateLog } from "./log";
import { discordMessages } from "./notice-formats";
import { postMessages } from "./notice-publish";

export interface PostsDeps {
  env: Pick<Env, "SERVER_TZ" | "WORKSPACE_KEYS_SECRET" | "WORKSPACE_DISCORD_WEBHOOKS">;
  fetch: typeof fetch;
  now: () => Date;
  report: AppContext["report"];
}

const languageOf = (code: string): WorkspaceLanguage =>
  (WORKSPACE_LANGUAGES as readonly string[]).includes(code) ? (code as WorkspaceLanguage) : "en";

/** The post's title: the officers' own, else ours in the post's language; a link in it never links. */
export const postTitle = (title: string, t: WorkspaceDictionary) =>
  breakLinks(title.trim() || t["posts.week.defaultTitle"]);

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

type Due = Awaited<ReturnType<typeof postsDue>>[number];

/** One workspace's week post: claimed, sent, and its outcome kept. */
async function sendWeek(db: Db, deps: PostsDeps, due: Due, period: string, post: CatalogPost) {
  const found = await settingsById(db, due.workspaceId);
  // The owner's layer (D134): a post the owner does not allow is never sent, whatever its switch says.
  if (!found || !resolveFeatures(found.settings, []).on.has(POST_CATALOG[post].feature)) return;
  const ws = { workspaceId: due.workspaceId, slug: due.slug };
  const channel = (await noticeChannels(db, ws, deps))[due.channel];
  if (!channel) return;
  const language = languageOf(due.language);
  const text = weekText(await weekOf(db, due.workspaceId, period), language);
  if (text === null) return;
  const run = { workspaceId: due.workspaceId, post, period };
  if (!(await claimPostRun(db, { ...run, at: deps.now() }))) return;
  const title = postTitle(due.title, WORKSPACE_DICTIONARIES[language]);
  // D156: the alliance's own line above our title, while its `post_callouts` is on.
  const lead = discordCallout(await liveCallout(db, due.workspaceId, post));
  const messages = discordMessages(title, [{ name: "", text }], !channel.forum, lead);
  const { sent, status } = await postMessages(deps.fetch, channel, title, messages);
  const done = sent === messages.length;
  // No answer at all (a timeout) may still have posted: never tried again, so the week is never doubled.
  const outcome = done ? "posted" : status === null ? "unanswered" : "failed";
  await finishPostRun(db, run, { status: outcome, sent });
  privateLog(done ? "posts.week.sent" : "posts.week.failed", {
    sent,
    of: messages.length,
    http: status ?? 0,
  });
}

/**
 * Every catalog post due now, for every workspace that has it on. Nothing is read when no post is due today
 * (the clock first); one workspace that fails never stops the others, and its error leaves as a code.
 */
export async function sendDuePosts(db: Db, deps: PostsDeps): Promise<void> {
  const now = deps.now();
  const period = postPeriod("week", now, deps.env);
  if (period === null) return;
  for (const due of await postsDue(db, "week", period)) {
    await sendWeek(db, deps, due, period, "week").catch((error: unknown) => {
      privateLog("posts.week.error");
      deps.report(error, { route: "lib/private/catalog-posts.ts", kind: "w.posts.send_failed" });
    });
  }
}
