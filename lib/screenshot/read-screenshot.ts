// The one module that runs the OCR (D74). Tesseract.js with the English data committed next to this
// file: no network at run time, nothing written to disk. A screenshot goes in, its text lines come out;
// the parsers turn lines into rows.
import path from "node:path";

import { createWorker, PSM } from "tesseract.js";

import { prepareForOcr } from "./prepare";

// From the working directory, not import.meta.url: bundlers rewrite that into an asset URL. A route
// that calls this must ship the folder with the function (outputFileTracingIncludes).
const LANG_PATH = path.join(process.cwd(), "lib", "screenshot", "tessdata");

export interface ScreenshotReader {
  /** The text lines of one screenshot, top to bottom. `image` is the file's bytes, never a path or URL. */
  read(image: Uint8Array): Promise<string[]>;
  close(): Promise<void>;
}

/** One worker for several pictures: starting it costs more than reading a page. */
export async function openScreenshotReader(): Promise<ScreenshotReader> {
  const worker = await createWorker("eng", 1, {
    langPath: LANG_PATH,
    cacheMethod: "none",
    gzip: true,
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
  } catch (error) {
    await worker.terminate();
    throw error;
  }
  return {
    async read(image) {
      const { data } = await worker.recognize(Buffer.from(prepareForOcr(image)));
      return data.text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "");
    },
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
