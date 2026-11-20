// The Raid Shield check's one message to the alliance's leaders' channel (issue 474, D137): posted after
// Friday night's read and edited in place by Saturday morning's, through the workspace's own leaders
// webhook (D129; WORKSPACE_DISCORD_WEBHOOKS as its fallback). Only when the officers turned it on in
// Alliance settings, never to the members' channel or anywhere public. Names only of members the tracker
// did not see shielded, as a hint (D75); nothing is logged but counts, and the webhook URL never is.
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
import {
  getShieldCheck,
  keepMessage,
  shieldReadings,
  type StoredReading,
} from "./repo/shield-checks";
import { anyRoster } from "./repo/workspace-any-roster";
import { sealedWebhooks } from "./repo/workspace-discord";
import { passWindows, suggestionOf, type ShieldPass } from "./shield-check";
import type { ShieldTarget } from "./shield-read";
import { masterFingerprint, openKey } from "./workspace-keys";

/** Names listed at most, so the message stays far under Discord's 2,000 characters. */
const NAMES_MAX = 40;
/** `message_hash` once Discord said the message was deleted. */
const GONE = "gone";

type PostEnv = Pick<Env, "SERVER_TZ" | "WORKSPACE_KEYS_SECRET" | "WORKSPACE_DISCORD_WEBHOOKS">;
export interface PostDeps {
  env: PostEnv;
  fetch: typeof fetch;
  now: () => Date;
  origin: string;
}

/** The leaders' webhook URL, opened for this call only; null when none is usable. */
async function leadersHook(db: Db, env: PostEnv, target: ShieldTarget): Promise<string | null> {
  const id = target.workspaceId as number;
  const row = (await sealedWebhooks(db, id)).find((r) => r.channel === "leaders");
  const secret = env.WORKSPACE_KEYS_SECRET;
  if (row && secret && row.masterFp === masterFingerprint(secret)) {
    try {
      return openKey(secret, id, row, "webhook-leaders");
    } catch {
      return null;
    }
  }
  if (row && secret) return null;
  return env.WORKSPACE_DISCORD_WEBHOOKS?.[target.slug]?.leaders?.url ?? null;
}

/** One read in numbers: who was seen shielded, who not yet, and the newest answer's time. */
export interface ReadSummary {
  shielded: number;
  read: number;
  unread: number;
  notSeen: string[];
  at: Date | null;
}

export function summarize(
  members: { uid: number; name: string }[],
  readings: StoredReading[],
): ReadSummary {
  const byUid = new Map(readings.map((r) => [r.uid, r]));
  let shielded = 0;
  let read = 0;
  const notSeen: string[] = [];
  let at: Date | null = null;
  for (const m of members) {
    const r = byUid.get(m.uid) ?? null;
    const s = suggestionOf(r);
    if (s === "unknown") continue;
    read++;
    if (r && (!at || r.readAt > at)) at = r.readAt;
    if (s === "on") shielded++;
    else notSeen.push(m.name);
  }
  notSeen.sort((a, b) => a.localeCompare(b));
  return { shielded, read, unread: members.length - read, notSeen, at };
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

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

/** The message: the title, each read's line, who was not seen in the newest read, the hint, the link. */
export function shieldMessage(
  w: ShieldPostWords,
  reads: { night: ReadSummary; morning: ReadSummary | null },
  zone: string,
  url: string,
): string {
  const lines = [readLine(w, reads.night, w.fri, zone)];
  if (reads.morning) lines.push(readLine(w, reads.morning, w.sat, zone));
  const newest = reads.morning ?? reads.night;
  const head = `${w.title}\n${lines.join("\n")}`;
  const list = newest.notSeen.length
    ? `\n${fill(reads.morning ? w.notSeenMorning : w.notSeen, { names: names(w, newest.notSeen) })}`
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
 * Posts the summary, or edits the one posted for this check, only when its text changed. A message
 * Discord says was deleted is not posted again (a code-only log line). Nothing when turned off or no
 * channel.
 */
export async function postShieldSummary(
  deps: PostDeps,
  db: Db,
  run: { day: string; target: ShieldTarget; pass: ShieldPass },
): Promise<boolean> {
  const { target } = run;
  if (!target.settings?.discord || target.workspaceId === null) return false;
  const q = { day: run.day, unionId: target.unionId };
  const check = await getShieldCheck(db, q);
  if (check?.messageHash === GONE) return false;
  const hook = await leadersHook(db, deps.env, target);
  if (!hook) return false;
  const content = await messageOf(deps, db, run);
  const hash = createHash("sha256").update(content).digest("hex");
  if (check?.messageId && check.messageHash === hash) return true;
  return deliver(deps, db, { q, hook, content, hash, id: check?.messageId ?? null });
}

/** The first post, or an edit of the posted message; a deleted message is marked `gone`, not posted. */
async function deliver(
  deps: PostDeps,
  db: Db,
  m: {
    q: { day: string; unionId: number };
    hook: string;
    content: string;
    hash: string;
    id: string | null;
  },
): Promise<boolean> {
  const body = { content: m.content, allowed_mentions: { parse: [] } };
  if (!m.id) {
    const id = await sendOrEdit(deps.fetch, m.hook, body, null);
    if (id) await keepMessage(db, m.q, { id, hash: m.hash }, deps.now());
    return id !== null;
  }
  const edited = await editOnly(deps.fetch, m.hook, body, m.id);
  if (edited === "failed") return false;
  if (edited === "gone") console.warn("shield.message_gone");
  const hash = edited === "ok" ? m.hash : GONE;
  await keepMessage(db, m.q, { id: m.id, hash }, deps.now());
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
  const members = ((await anyRoster(db, target.unionId))?.members ?? []).map((m) => ({
    uid: m.uid,
    name: m.name,
  }));
  const night = summarize(
    members,
    await shieldReadings(db, target.unionId, windows.night.from, windows.night.to),
  );
  // Until the morning read has an answer, the message keeps Friday's summary and names.
  const read =
    run.pass === "morning"
      ? summarize(
          members,
          await shieldReadings(db, target.unionId, windows.morning.from, windows.morning.to),
        )
      : null;
  const morning = read && read.read > 0 ? read : null;
  const lang = target.settings?.language as ShieldLanguage;
  const words = SHIELD_POST[SHIELD_LANGUAGES.includes(lang) ? lang : "en"];
  const url = `${deps.origin}/w/${target.slug}/roll-call?week=${mondayOf(day)}`;
  return shieldMessage(words, { night, morning }, deps.env.SERVER_TZ, url);
}
