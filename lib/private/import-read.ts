// The desk's and the Discord command's way to the OCR (issue 299, D74): pages reach the reader only
// through lib/private. The picture's bytes stay in memory for the reading and are not kept.
import { classifyScreen, readScreen } from "../screenshot/classify";
import { ImageRefusedError } from "../screenshot/prepare";
import {
  openScreenshotReader,
  ReaderFailedError,
  type ScreenshotReader,
} from "../screenshot/read-screenshot";
import type { PictureText } from "./import";

/** A failed reading as a log code, never its message: `<prefix>:reader:<reason>` or `<prefix>:other`. */
export const failureCode = (prefix: string, error: unknown): string =>
  error instanceof ReaderFailedError ? `${prefix}:reader:${error.reason}` : `${prefix}:other`;

/**
 * One Tesseract worker per function instance, started on first use and kept: starting it costs more
 * than reading a page (D74). Its jobs run one after another. A worker that fails is dropped and closed,
 * so the next use starts a new one.
 */
let shared: Promise<ScreenshotReader> | null = null;

/** The instance's reader. Closing it keeps the worker for the next request. */
export function openOcr(): Promise<ScreenshotReader> {
  const current = (shared ??= openScreenshotReader().catch((error: unknown) => {
    shared = null;
    throw error;
  }));
  /** A failed reading drops the worker (it may be broken or dead); a refused picture keeps it. */
  const dropped = (error: unknown): never => {
    if (!(error instanceof ImageRefusedError) && shared === current) {
      shared = null;
      void current.then((reader) => reader.close()).catch(() => undefined);
    }
    throw error;
  };
  return current.then((reader) => ({
    read: (image, options) => reader.read(image, options).catch(dropped),
    toPng: (image) => reader.toPng(image).catch(dropped),
    close: async () => undefined,
  }));
}

/**
 * Officers with pictures being read on this instance (D109): one reading at a time each, whether it comes
 * from "Read from a screenshot", "Send screenshots" or a share from the phone (D110), so the reader is not
 * hammered. Per server instance; freed when the reading ends or fails.
 */
const reading = new Set<number>();

/** Takes the officer's one reading; false when one is already running. */
export function startReading(officer: number): boolean {
  if (reading.has(officer)) return false;
  reading.add(officer);
  return true;
}

export function endReading(officer: number): void {
  reading.delete(officer);
}

/**
 * One uploaded picture's text lines. "Send screenshots" already dropped the phone's status bar; a picture
 * shared from the phone (D110) still has it. Null when the picture's size is refused (no pixels, too
 * many, or a size its header does not state).
 */
export async function readUpload(image: Uint8Array, statusBar = false): Promise<string[] | null> {
  const reader = await openOcr();
  try {
    return (await readScreen(reader, image, { statusBar })).lines;
  } catch (error) {
    if (error instanceof ImageRefusedError) return null;
    throw error;
  }
}

/** Pictures sent back as their text lines: classified again on the server, so a map stays a map. */
export const classified = (pages: string[][]): PictureText[] =>
  pages.map((lines) => ({ lines, classified: classifyScreen(lines) }));
