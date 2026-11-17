// The one module that runs the OCR (D74). Tesseract.js with the English data committed next to this
// file: no network at run time, nothing written to disk. A screenshot goes in, its text lines come out;
// the parsers turn lines into rows.
import { subscribe, unsubscribe } from "node:diagnostics_channel";
import path from "node:path";
import type { Worker as Thread } from "node:worker_threads";

import { createWorker, PSM, type Worker } from "tesseract.js";

import { pictureSize } from "./picture-size";
import { ImageRefusedError, MAX_PIXELS, prepareForOcr, type PrepareOptions } from "./prepare";

// From the working directory, not import.meta.url: bundlers rewrite that into an asset URL. A route
// that calls this must ship the folder with the function (outputFileTracingIncludes).
const LANG_PATH = path.join(process.cwd(), "lib", "screenshot", "tessdata");

/** A worker call (its start, or one picture's reading) not answered by then is given up. */
export const CALL_MS = 20_000;

/** The OCR worker died or did not answer within CALL_MS: its thread is stopped, the reader is spent. */
export class ReaderFailedError extends Error {}

/**
 * Runs `start` and returns the worker thread it spawned. Tesseract.js watches its thread with
 * `onerror`, which a Node worker thread never calls: a thread that fails to load (a missing module) or
 * crashes would throw an uncaught exception and leave its jobs waiting forever. Node publishes each new
 * thread on the `worker_threads` channel while constructing it, and createWorker spawns its thread
 * before its first await, so the thread published during `start` is its own.
 */
function spawning<T>(start: () => T): { started: T; thread: Thread | undefined } {
  let thread: Thread | undefined;
  const seen = (message: unknown) => {
    thread ??= (message as { worker: Thread }).worker;
  };
  subscribe("worker_threads", seen);
  try {
    const started = start();
    return { started, thread };
  } finally {
    unsubscribe("worker_threads", seen);
  }
}

export interface ScreenshotReader {
  /** The text lines of one screenshot, top to bottom. `image` is the file's bytes, never a path or URL. */
  read(image: Uint8Array, options?: PrepareOptions): Promise<string[]>;
  /** The picture as a PNG (a PNG as it is): reading it twice converts it once. */
  toPng(image: Uint8Array): Promise<Uint8Array>;
  close(): Promise<void>;
}

const isPng = (image: Uint8Array) =>
  image[0] === 0x89 && image[1] === 0x50 && image[2] === 0x4e && image[3] === 0x47;

/**
 * A JPEG, WebP or other picture as a PNG, decoded by Tesseract's own image library with no text
 * recognition, so it is prepared like a PNG (issue 299: a JPEG read raw lost rows). Unchanged when
 * the library cannot decode it. The size its header states is checked first: a picture over MAX_PIXELS,
 * or one whose size cannot be read, throws ImageRefusedError before anything decodes it.
 */
async function asPng(worker: Pick<Worker, "recognize">, image: Uint8Array): Promise<Uint8Array> {
  if (isPng(image)) return image;
  const size = pictureSize(image);
  if (!size || size.width === 0 || size.height === 0) {
    throw new ImageRefusedError("its size cannot be read (only PNG, JPEG and WebP are)");
  }
  if (size.width * size.height > MAX_PIXELS) throw new ImageRefusedError("it has too many pixels");
  const { data } = await worker.recognize(
    Buffer.from(image),
    {},
    { text: false, imageColor: true },
  );
  const base64 = data.imageColor?.split(",")[1];
  return base64 ? Buffer.from(base64, "base64") : image;
}

/**
 * One worker for several pictures: starting it costs more than reading a page. Every call settles: it
 * rejects with ReaderFailedError when the worker's thread dies or the call takes over CALL_MS, and the
 * thread is stopped.
 */
export async function openScreenshotReader(): Promise<ScreenshotReader> {
  const { started, thread } = spawning(() =>
    createWorker("eng", 1, {
      langPath: LANG_PATH,
      cacheMethod: "none",
      gzip: true,
      // A failed job rejects its promise; without a handler Tesseract.js also throws it, uncaught.
      errorHandler: () => undefined,
    }),
  );
  const died = new Promise<never>((_, reject) => {
    thread?.on("error", () => reject(new ReaderFailedError("the OCR worker failed")));
    thread?.on("exit", () => reject(new ReaderFailedError("the OCR worker stopped")));
  });
  // The thread may die while no call is waiting.
  died.catch(() => undefined);
  const settled = async <T>(work: Promise<T>): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new ReaderFailedError(`the OCR worker did not answer in ${CALL_MS} ms`)),
        CALL_MS,
      );
    });
    try {
      return await Promise.race([work, died, late]);
    } catch (error) {
      if (error instanceof ReaderFailedError) void thread?.terminate();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
  const worker = await settled(started);
  try {
    await settled(worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK }));
  } catch (error) {
    await worker.terminate();
    throw error;
  }
  const ocr: Pick<Worker, "recognize"> = {
    recognize: (...args) => settled(worker.recognize(...args)),
  };
  return {
    async read(image, options) {
      const png = await asPng(ocr, image);
      const { data } = await ocr.recognize(Buffer.from(prepareForOcr(png, options)));
      return data.text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "");
    },
    toPng: (image) => asPng(ocr, image),
    close: async () => {
      await worker.terminate();
    },
  };
}

/** The text lines of one screenshot. Reading several pictures: open a reader and keep it. */
export async function readScreenshot(image: Uint8Array): Promise<string[]> {
  const reader = await openScreenshotReader();
  try {
    return await reader.read(image);
  } finally {
    await reader.close();
  }
}
