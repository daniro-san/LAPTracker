// The one module that runs the OCR (D74). Tesseract.js with the English data committed next to this
// file: no network at run time, nothing written to disk. A screenshot goes in, its text lines come out;
// the parsers turn lines into rows.
import path from "node:path";

import { createWorker, PSM, type Worker } from "tesseract.js";

import { prepareForOcr, type PrepareOptions } from "./prepare";

// From the working directory, not import.meta.url: bundlers rewrite that into an asset URL. A route
// that calls this must ship the folder with the function (outputFileTracingIncludes).
const LANG_PATH = path.join(process.cwd(), "lib", "screenshot", "tessdata");

export interface ScreenshotReader {
  /** The text lines of one screenshot, top to bottom. `image` is the file's bytes, never a path or URL. */
  read(image: Uint8Array, options?: PrepareOptions): Promise<string[]>;
  close(): Promise<void>;
}

const isPng = (image: Uint8Array) =>
  image[0] === 0x89 && image[1] === 0x50 && image[2] === 0x4e && image[3] === 0x47;

/**
 * A JPEG, WebP or other picture as a PNG, decoded by Tesseract's own image library with no text
 * recognition, so it is prepared like a PNG (issue 299: a JPEG read raw lost rows). Unchanged when
 * the library cannot decode it.
 */
async function asPng(worker: Worker, image: Uint8Array): Promise<Uint8Array> {
  if (isPng(image)) return image;
  const { data } = await worker.recognize(
    Buffer.from(image),
    {},
    { text: false, imageColor: true },
  );
  const base64 = data.imageColor?.split(",")[1];
  return base64 ? Buffer.from(base64, "base64") : image;
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
    async read(image, options) {
      const png = await asPng(worker, image);
      const { data } = await worker.recognize(Buffer.from(prepareForOcr(png, options)));
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
