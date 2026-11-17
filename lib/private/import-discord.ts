// The Discord command's reading, after the "thinking…" reply was sent (issue 299, D96): each picture is
// fetched from Discord's CDN only (two hosts, https, no redirect, a size cap), read by the OCR, and
// forgotten; the drafts are made and the sender's reply is edited to say what was read, with a link to
// review it. A non-PNG asks Discord's media proxy for a PNG first (`format=png`); the original is the
// fallback, which the reader decodes itself. No picture is stored, logged or sent anywhere else.
import type { Db } from "../db";
import { settlePictures } from "../repo/import";
import { serverDay } from "../schedule";
import { readScreen } from "../screenshot/classify";
import { ImageRefusedError } from "../screenshot/prepare";
import type { ScreenshotReader } from "../screenshot/read-screenshot";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { editOriginal } from "./discord-api";
import type { Attachment, Job } from "./discord-interaction";
import { createDrafts, MAX_PICTURES, type PictureText } from "./import";
import { failureCode } from "./import-read";
import { outcomeLines } from "./import-words";
import { privateLog } from "./log";

/** A picture larger than this is not fetched (a phone screenshot is 0.2-3 MB). */
export const MAX_PICTURE_BYTES = 8 * 1024 * 1024;
const HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const TIMEOUT_MS = 10_000;
/** Pictures fetched at once. */
const FETCHES = 4;
/** The reading stops here, so the drafts and the reply's edit fit in the function's 60 s. */
const DEADLINE_MS = 45_000;

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
  const res = await editOriginal(deps.fetch, deps.discordBase, job.webhook, { content });
  if (!res) privateLog("w.import.reply_failed");
  else if (!res.ok) privateLog("w.import.reply_failed", { status: res.status });
}

/** One fetched picture read, or null when it could not be fetched or its size was refused. */
async function readOne(reader: ScreenshotReader, bytes: Uint8Array | null) {
  if (!bytes) return null;
  try {
    // A phone screenshot posted as is still has its status bar.
    return await readScreen(reader, bytes, { statusBar: true });
  } catch (error) {
    if (error instanceof ImageRefusedError) return null;
    throw error;
  }
}

/** Runs `work` with at most `n` running at once. */
function limit(n: number) {
  let free = n;
  const waiting: (() => void)[] = [];
  return async <R>(work: () => Promise<R>): Promise<R> => {
    if (free > 0) free -= 1;
    else await new Promise<void>((go) => waiting.push(go));
    try {
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else free += 1;
    }
  };
}

const LATE = Symbol("late");

/** What `work` settles to, or LATE when it has not settled within `ms`; work left behind is not awaited. */
async function within<T>(work: Promise<T>, ms: number): Promise<T | typeof LATE> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<typeof LATE>((resolve) => {
    timer = setTimeout(resolve, ms, LATE);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches the pictures, FETCHES at a time, and reads them in order until DEADLINE_MS has passed since
 * the job started (a picture still being read then is left); `lost` counts the ones not fetched, not
 * read, or left for lack of time. A reader that fails (ReaderFailedError) fails the job.
 */
async function readPictures(deps: JobDeps, job: Job) {
  const started = deps.now().getTime();
  const slot = limit(FETCHES);
  const fetches = job.pictures
    .slice(0, MAX_PICTURES)
    .map((a) => slot(() => fetchPicture(deps.fetch, a)));
  const pictures: PictureText[] = [];
  /** The attachment id of each entry of `pictures`. */
  const ids: string[] = [];
  const reader = await deps.openReader();
  try {
    for (const [i, fetched] of fetches.entries()) {
      const left = DEADLINE_MS - (deps.now().getTime() - started);
      if (left <= 0) break;
      const read = await within(
        fetched.then((bytes) => readOne(reader, bytes)),
        left,
      );
      if (read === LATE) break;
      if (read) {
        pictures.push(read);
        ids.push(job.pictures[i]?.id ?? "");
      }
    }
  } finally {
    await reader.close();
  }
  return { pictures, ids, lost: job.pictures.length - pictures.length };
}

/** Each read picture's draft id (null: it made none), by attachment id. */
function draftOfEach(
  ids: readonly string[],
  result: Awaited<ReturnType<typeof createDrafts>>,
): Map<string, number | null> {
  return new Map(
    ids.map((id, i) => {
      const o = result.outcomes[i];
      return [id, o?.status === "draft" ? (result.drafts[o.draft]?.id ?? null) : null];
    }),
  );
}

/**
 * The work after the deferred reply: read, make the drafts, then edit the reply to say what happened.
 * The edit always runs: on any failure it carries `shots.discord.failed`, and the failure is logged as
 * a code only.
 */
export async function runJob(deps: JobDeps, job: Job): Promise<void> {
  const t = WORKSPACE_DICTIONARIES[job.language];
  const { db, close } = deps.openDb();
  const key = { workspaceId: job.access.workspaceId, messageId: job.messageId };
  const all = job.pictures.map((p) => p.id);
  let content = t["shots.discord.failed"];
  try {
    const { pictures, ids, lost } = await readPictures(deps, job);
    const result = await createDrafts(db, job.access, pictures, {
      source: "discord",
      sentBy: job.access.user.displayName,
      pictureDay: serverDay(job.postedAt, { SERVER_TZ: deps.serverTz }),
      now: deps.now(),
    });
    // A picture not read (lost) is let go, so the next run on the message tries it again.
    await settlePictures(
      db,
      key,
      draftOfEach(ids, result),
      all.filter((id) => !ids.includes(id)),
    );
    const review = (id: number) => `${deps.origin}/w/${job.access.slug}/shots/${id}`;
    content = outcomeLines(t, job.language, result, lost, review).join("\n");
    const drafts = result.drafts.length;
    privateLog("w.import.discord", { workspace: job.access.workspaceId, drafts, lost });
  } catch (error) {
    privateLog(failureCode("w.import.discord_failed", error), {
      workspace: job.access.workspaceId,
    });
    // Nothing was made: every picture of this run can be sent again.
    await settlePictures(db, key, new Map(), all).catch(() => undefined);
  } finally {
    await editReply(deps, job, content);
    await close();
  }
}
