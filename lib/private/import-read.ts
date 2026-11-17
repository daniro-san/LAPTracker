// The desk's and the Discord command's way to the OCR (issue 299, D74): pages reach the reader only
// through lib/private. The picture's bytes stay in memory for the reading and are not kept.
import { classifyScreen, readScreen } from "../screenshot/classify";
import { ImageRefusedError } from "../screenshot/prepare";
import { openScreenshotReader, type ScreenshotReader } from "../screenshot/read-screenshot";
import type { PictureText } from "./import";

export const openOcr = (): Promise<ScreenshotReader> => openScreenshotReader();

/**
 * One uploaded picture's text lines. The browser already dropped the phone's status bar. Null when the
 * picture's size is refused (no pixels, or too many).
 */
export async function readUpload(image: Uint8Array): Promise<string[] | null> {
  const reader = await openOcr();
  try {
    return (await readScreen(reader, image, { statusBar: false })).lines;
  } catch (error) {
    if (error instanceof ImageRefusedError) return null;
    throw error;
  } finally {
    await reader.close();
  }
}

/** Pictures sent back as their text lines: classified again on the server, so a map stays a map. */
export const classified = (pages: string[][]): PictureText[] =>
  pages.map((lines) => ({ lines, classified: classifyScreen(lines) }));
