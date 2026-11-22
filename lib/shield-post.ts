// The Raid Shield check's one message to the alliance's leadership (issue 474, D137): posted after Friday
// night's read and edited in place by Saturday morning's, only through the workspace's own Raid Shield
// channel (D147, owner's rule of 2026-11-21): without one, nothing is posted, never to the leaders' channel.
// Only when the officers turned it on in Alliance settings, never to the members' channel or anywhere
// public. Names only of members the tracker did not see shielded, as a hint (D75); away members are left
// out of the names, as the desk's "Copy names" leaves them out, and shown as a count only (D137,
// 2026-11-22). Nothing is logged but counts, and the webhook URL never is.
import { createHash } from "node:crypto";

import {
  SHIELD_LANGUAGES,
  SHIELD_POST,
  type ShieldLanguage,
  type ShieldPostWords,
} from "./copy-shield";
import type { Db } from "./db";
import { discordClock } from "./discord-format";
import { editOnly, sendOrEdit } from "./discord-send";
import type { Env } from "./env";
import { escapeDiscord } from "./notify";
import { membersOfRaid } from "./raid-prep-fill";
import {
  getShieldCheck,
  keepMessage,
  shieldReadings,
  type StoredReading,
} from "./repo/shield-checks";
import { sealedWebhooks } from "./repo/workspace-discord";
import { passWindows, suggestionOf, type ShieldPass } from "./shield-check";
import type { ShieldTarget } from "./shield-read";
import { fill, plural } from "./words";
import { masterFingerprint, openKey } from "./workspace-keys";

/** Names listed at most, so the message stays far under Discord's 2,000 characters. */
const NAMES_MAX = 40;
/** `message_hash` once Discord said the message was deleted. */
const GONE = "gone";

type PostEnv = Pick<Env, "SERVER_TZ" | "WORKSPACE_KEYS_SECRET">;
export interface PostDeps {
  env: PostEnv;
  fetch: typeof fetch;
  now: () => Date;
  origin: string;
}

/**
 * The webhook to post through, opened for this call only: its URL, whether it is a forum, and `key`, the
 * URL's sha256 (on one host: discordapp.com is discord.com), stored with the message so it is edited only
 * through the same webhook (D147).
 */
type Hook = { url: string; forum: boolean; key: string };
const hookOf = (url: string, forum: boolean): Hook => ({
  url,
  forum,
  key: createHash("sha256")
    .update(url.replace(/^https:\/\/discordapp\.com\//, "https://discord.com/"))
    .digest("hex"),
});

/**
 * The Raid Shield channel the workspace saved, and nothing else (D147, owner's rule of 2026-11-21): none
 * saved, one the master key cannot open, or no master key posts nothing, never to the leaders' channel or
 * the site's.
 */
async function summaryHook(db: Db, env: PostEnv, target: ShieldTarget): Promise<Hook | null> {
  const id = target.workspaceId as number;
  const secret = env.WORKSPACE_KEYS_SECRET;
  if (!secret) return null;
  const row = (await sealedWebhooks(db, id)).find((r) => r.channel === "shield");
  if (!row || row.masterFp !== masterFingerprint(secret)) return null;
  try {
    return hookOf(openKey(secret, id, row, "webhook-shield"), row.forum);
  } catch {
    return null;
  }
}

/**
 * One read in numbers: who was seen shielded, who not yet (away members left out of the names, counted in
 * `away`), and the newest answer's time.
 */
export interface ReadSummary {
  shielded: number;
  read: number;
  unread: number;
  notSeen: string[];
  away: number;
  at: Date | null;
}

export function summarize(
  members: { uid: number; name: string }[],
  readings: StoredReading[],
  away: ReadonlySet<number> = new Set(),
): ReadSummary {
  const byUid = new Map(readings.map((r) => [r.uid, r]));
  let shielded = 0;
  let read = 0;
  const notSeen: string[] = [];
  let awayNotSeen = 0;
  let at: Date | null = null;
  for (const m of members) {
    const r = byUid.get(m.uid) ?? null;
    const s = suggestionOf(r);
    if (s === "unknown") continue;
    read++;
    if (r && (!at || r.readAt > at)) at = r.readAt;
    if (s === "on") shielded++;
    else if (away.has(m.uid)) awayNotSeen++;
    else notSeen.push(m.name);
  }
  notSeen.sort((a, b) => a.localeCompare(b));
  return { shielded, read, unread: members.length - read, notSeen, away: awayNotSeen, at };
}

function readLine(w: ShieldPostWords, s: ReadSummary, day: string, zone: string) {
  const time = s.at ? discordClock(zone).time(s.at) : "–";
  const line = fill(w.read, { day, time, n: s.shielded, total: s.read });
  return s.unread > 0 ? `${line} · ${fill(w.unread, { n: s.unread })}` : line;
}

/** Names typed in game show literally: Discord markdown and mentions are escaped (lib/notify.ts). */
const names = (w: ShieldPostWords, list: string[]) => {
  const shown = list.slice(0, NAMES_MAX).map(escapeDiscord).join(", ");
  const rest = list.length - NAMES_MAX;
  return rest > 0 ? `${shown} ${fill(w.more, { n: rest })}` : shown;
};

/**
 * The message: the title, each read's line, who was not seen in the newest read (then how many away members
 * were left out, a count only), the hint, the link.
 */
export function shieldMessage(
  w: ShieldPostWords,
  reads: { night: ReadSummary; morning: ReadSummary | null },
  zone: string,
  url: string,
  language: string,
): string {
  const lines = [readLine(w, reads.night, w.fri, zone)];
  if (reads.morning) lines.push(readLine(w, reads.morning, w.sat, zone));
  const newest = reads.morning ?? reads.night;
  const head = `${w.title}\n${lines.join("\n")}`;
  const away = newest.away
    ? fill(plural(newest.away, { one: w.awayOne, other: w.away }, language), { n: newest.away })
    : "";
  const shown = [names(w, newest.notSeen), away].filter(Boolean).join(" · ");
  const list = shown
    ? `\n${fill(reads.morning ? w.notSeenMorning : w.notSeen, { names: shown })}`
    : "";
  return `${head}${list}\n${w.hint}\n${fill(w.link, { url })}`;
}

/** The Monday of the week holding Friday `day`: the Roll call page of that week. */
const mondayOf = (day: string) => {
  const t = Date.parse(`${day}T00:00:00Z`);
  const back = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - back * 86_400_000).toISOString().slice(0, 10);
};

/**
 * Posts the summary, or edits the one posted for this check through the same webhook, only when its text
 * changed. A message Discord says was deleted is not posted again in that channel (a code-only log line).
 * A channel changed since the message was posted gets a fresh one, and the old message is left as it is
 * (D147). Nothing when turned off or no channel.
 */
export async function postShieldSummary(
  deps: PostDeps,
  db: Db,
  run: { day: string; target: ShieldTarget; pass: ShieldPass },
): Promise<boolean> {
  const { target } = run;
  if (!target.settings?.discord || target.workspaceId === null) return false;
  const q = { day: run.day, unionId: target.unionId };
  const hook = await summaryHook(db, deps.env, target);
  if (!hook) return false;
  const posted = await postedThrough(db, q, hook);
  if (posted?.hash === GONE) return false;
  const { content, title } = await messageOf(deps, db, run);
  const hash = createHash("sha256").update(content).digest("hex");
  if (posted?.hash === hash) return true;
  return deliver(deps, db, { q, hook, content, title, hash, id: posted?.id ?? null });
}

/**
 * The check's message, only when it went through this same webhook: else the channel changed (D147). A
 * message posted before D147 has no `message_hook`: it went through the leaders' channel, so it is never
 * edited, and the Raid Shield channel gets a fresh post.
 */
async function postedThrough(db: Db, q: { day: string; unionId: number }, hook: Hook) {
  const check = await getShieldCheck(db, q);
  if (!check?.messageId || check.messageHook !== hook.key) return null;
  return { id: check.messageId, hash: check.messageHash };
}

/**
 * The first post, or an edit of the posted message; a deleted message is marked `gone`, not posted. A forum
 * channel refuses a post without a title (`thread_name`: a 400), and the first message of a forum post has
 * the post's own id, so an edit there names that id as `thread_id`.
 */
async function deliver(
  deps: PostDeps,
  db: Db,
  m: {
    q: { day: string; unionId: number };
    hook: Hook;
    content: string;
    title: string;
    hash: string;
    id: string | null;
  },
): Promise<boolean> {
  const body = { content: m.content, allowed_mentions: { parse: [] } };
  if (!m.id) {
    const first = m.hook.forum ? { ...body, thread_name: m.title } : body;
    const id = await sendOrEdit(deps.fetch, m.hook.url, first, null);
    if (id) await keepMessage(db, m.q, { id, hash: m.hash, hook: m.hook.key }, deps.now());
    return id !== null;
  }
  const thread = m.hook.forum ? m.id : null;
  const edited = await editOnly(deps.fetch, m.hook.url, body, m.id, thread);
  if (edited === "failed") return false;
  if (edited === "gone") console.warn("shield.message_gone");
  const hash = edited === "ok" ? m.hash : GONE;
  await keepMessage(db, m.q, { id: m.id, hash, hook: m.hook.key }, deps.now());
  return edited === "ok";
}

/** The message's text from the stored readings of both reads. */
async function messageOf(
  deps: PostDeps,
  db: Db,
  run: { day: string; target: ShieldTarget; pass: ShieldPass },
) {
  const { target, day } = run;
  const windows = passWindows(day, deps.env);
  const { members, away } = await membersOfRaid(db, target, day, deps.env.SERVER_TZ);
  const night = summarize(
    members,
    await shieldReadings(db, target.unionId, windows.night.from, windows.night.to),
    away,
  );
  // Until the morning read has an answer, the message keeps Friday's summary and names.
  const read =
    run.pass === "morning"
      ? summarize(
          members,
          await shieldReadings(db, target.unionId, windows.morning.from, windows.morning.to),
          away,
        )
      : null;
  const morning = read && read.read > 0 ? read : null;
  const lang = target.settings?.language as ShieldLanguage;
  const language = SHIELD_LANGUAGES.includes(lang) ? lang : "en";
  const words = SHIELD_POST[language];
  const url = `${deps.origin}/w/${target.slug}/roll-call?week=${mondayOf(day)}`;
  const content = shieldMessage(words, { night, morning }, deps.env.SERVER_TZ, url, language);
  // The forum post's title: the message's title without its bold marks.
  return { content, title: words.title.replaceAll("*", "") };
}
