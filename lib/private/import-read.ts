// The desk's and the Discord command's way to the OCR (issue 299, D74): pages reach the reader only
// through lib/private. The picture's bytes stay in memory for the reading and are not kept.
import { classifyScreen, readScreen } from "../screenshot/classify";
import { ImageRefusedError } from "../screenshot/prepare";
import { openScreenshotReader, type ScreenshotReader } from "../screenshot/read-screenshot";
import type { PictureText } from "./import";

/**
 * One Tesseract worker per function instance, started on first use and kept: starting it costs more
 * than reading a page (D74). Its jobs run one after another. A worker that fails is dropped, so the next
 * use starts a new one.
 */
let shared: Promise<ScreenshotReader> | null = null;

/** The instance's reader. Closing it keeps the worker for the next request. */
export function openOcr(): Promise<ScreenshotReader> {
  shared ??= openScreenshotReader().catch((error: unknown) => {
    shared = null;
    throw error;
  });
  return shared.then((reader) => ({
    read: (image, options) => reader.read(image, options).catch(dropped),
    toPng: (image) => reader.toPng(image).catch(dropped),
    close: async () => undefined,
  }));
}

/** A failed reading drops the worker (it may be broken); a refused picture keeps it. */
function dropped(error: unknown): never {
  if (!(error instanceof ImageRefusedError)) shared = null;
  throw error;
}

/**
 * One uploaded picture's text lines. The browser already dropped the phone's status bar. Null when the
 * picture's size is refused (no pixels, too many, or a size its header does not state).
 */
export async function readUpload(image: Uint8Array): Promise<string[] | null> {
  const reader = await openOcr();
  try {
    return (await readScreen(reader, image, { statusBar: false })).lines;
  } catch (error) {
    if (error instanceof ImageRefusedError) return null;
    throw error;
  }
}

/** Pictures sent back as their text lines: classified again on the server, so a map stays a map. */
export const classified = (pages: string[][]): PictureText[] =>
  pages.map((lines) => ({ lines, classified: classifyScreen(lines) }));
