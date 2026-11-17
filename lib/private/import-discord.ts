// The Discord command's reading, after the "thinking…" reply was sent (issue 299, D96): each picture is
// fetched from Discord's CDN only (two hosts, https, no redirect, a size cap), read by the OCR, and
// forgotten; the drafts are made and the sender's reply is edited to say what was read, with a link to
// review it. A non-PNG asks Discord's media proxy for a PNG first (`format=png`); the original is the
// fallback, which the reader decodes itself. No picture is stored, logged or sent anywhere else.
import type { Db } from "../db";
import { serverDay } from "../schedule";
import { readScreen } from "../screenshot/classify";
import { ImageRefusedError } from "../screenshot/prepare";
import type { ScreenshotReader } from "../screenshot/read-screenshot";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import type { Attachment, Job } from "./discord-interaction";
import { createDrafts, MAX_PICTURES, type PictureText } from "./import";
import { outcomeLines } from "./import-words";
import { privateLog } from "./log";

/** A picture larger than this is not fetched (a phone screenshot is 0.2-3 MB). */
export const MAX_PICTURE_BYTES = 8 * 1024 * 1024;
const HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const TIMEOUT_MS = 10_000;

export interface JobDeps {
  openDb: () => { db: Db; close: () => Promise<void> };
  fetch: typeof fetch;
  openReader: () => Promise<ScreenshotReader>;
  /** DISCORD_API_BASE_URL: the interaction webhook's base. */
  discordBase: string;
  /** The app's origin, for the review link. */
  origin: string;
  serverTz: string;
  now: () => Date;
}

/** An attachment address on Discord's CDN over https; null for any other host. */
function onDiscord(address: string | undefined): URL | null {
  try {
    const url = new URL(address ?? "");
    return url.protocol === "https:" && HOSTS.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

/** The body, or null past MAX_PICTURE_BYTES, on a non-2xx, a redirect, a timeout or a network error. */
async function capped(fetcher: typeof fetch, url: URL): Promise<Uint8Array | null> {
  try {
    const res = await fetcher(url.href, {
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok || !res.body) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_PICTURE_BYTES) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.byteLength;
      if (size > MAX_PICTURE_BYTES) return null;
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/** One attachment's bytes, in memory only; null when it cannot be fetched under the rules above. */
export async function fetchPicture(
  fetcher: typeof fetch,
  a: Attachment,
): Promise<Uint8Array | null> {
  if (a.size > MAX_PICTURE_BYTES) return null;
  const proxy = a.content_type === "image/png" ? null : onDiscord(a.proxy_url);
  if (proxy) {
    proxy.searchParams.set("format", "png");
    const png = await capped(fetcher, proxy);
    if (png && isPng(png)) return png;
  }
  const original = onDiscord(a.url);
  return original ? capped(fetcher, original) : null;
}

/** Edits the sender's "thinking…" reply; mentions are off. A failure is logged as a code only. */
async function editReply(deps: JobDeps, job: Job, content: string): Promise<void> {
  const { applicationId, token } = job.webhook;
  const url = `${deps.discordBase.replace(/\/$/, "")}/webhooks/${applicationId}/${token}/messages/@original`;
  try {
    const res = await deps.fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) privateLog("w.import.reply_failed", { status: res.status });
  } catch {
    privateLog("w.import.reply_failed");
  }
}

/** One picture read, or null when it could not be fetched or its size was refused. */
async function readOne(deps: JobDeps, reader: ScreenshotReader, a: Attachment) {
  const bytes = await fetchPicture(deps.fetch, a);
  if (!bytes) return null;
  try {
    // A phone screenshot posted as is still has its status bar.
    return await readScreen(reader, bytes, { statusBar: true });
  } catch (error) {
    if (error instanceof ImageRefusedError) return null;
    throw error;
  }
}

/** Fetches and reads each picture; `lost` counts the ones that could not be fetched or read. */
async function readPictures(deps: JobDeps, job: Job) {
  const pictures: PictureText[] = [];
  const reader = await deps.openReader();
  try {
    for (const attachment of job.pictures.slice(0, MAX_PICTURES)) {
      const read = await readOne(deps, reader, attachment);
      if (read) pictures.push(read);
    }
  } finally {
    await reader.close();
  }
  return { pictures, lost: job.pictures.length - pictures.length };
}

/** The work after the deferred reply: read, make the drafts, then edit the reply to say what happened. */
export async function runJob(deps: JobDeps, job: Job): Promise<void> {
  const t = WORKSPACE_DICTIONARIES[job.language];
  const { db, close } = deps.openDb();
  let content = t["import.discord.failed"];
  try {
    const { pictures, lost } = await readPictures(deps, job);
    const result = await createDrafts(db, job.access, pictures, {
      source: "discord",
      sentBy: job.access.user.displayName,
      pictureDay: serverDay(job.postedAt, { SERVER_TZ: deps.serverTz }),
      now: deps.now(),
    });
    const review = (id: number) => `${deps.origin}/w/${job.access.slug}/import/${id}`;
    content = outcomeLines(t, job.language, result, lost, review).join("\n");
    const drafts = result.drafts.length;
    privateLog("w.import.discord", { workspace: job.access.workspaceId, drafts, lost });
  } catch {
    privateLog("w.import.discord_failed", { workspace: job.access.workspaceId });
  } finally {
    await close();
  }
  await editReply(deps, job, content);
}
