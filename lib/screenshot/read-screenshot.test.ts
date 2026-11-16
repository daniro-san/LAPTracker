// Opt-in OCR test: OCR_TEST=1 pnpm vitest run lib/screenshot/read-screenshot.test.ts
// It runs the real Tesseract on three screenshots (about 1 s each on an idle machine, much more on a
// loaded one) and compares with the text recorded in fixtures/screenshots. Not part of `pnpm check`:
// the default run skips it. Re-recording a fixture is a deliberate act, never a side effect of a test.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseAllianceDuelRanking } from "./parse-alliance-duel";
import { parseRanking } from "./parse-ranking";
import { parseSecretOpsReport } from "./parse-secret-ops";
import { openScreenshotReader, type ScreenshotReader } from "./read-screenshot";
import { recorded, screenshot } from "./test-helpers";

const SLOW = 180_000;
/** The share of the recorded lines the OCR must reproduce exactly; the wasm core can differ a little between CPUs. */
const SAME_LINES = 0.9;

const sameLines = (lines: string[], recording: string[]) =>
  recording.filter((line) => lines.includes(line)).length / recording.length;

describe.skipIf(process.env.OCR_TEST !== "1")("screenshot OCR (OCR_TEST=1)", () => {
  let reader: ScreenshotReader;
  beforeAll(async () => {
    reader = await openScreenshotReader();
  }, SLOW);
  afterAll(async () => {
    await reader.close();
  });

  it(
    "reads an Alliance Duel page to the text and rows that were recorded",
    async () => {
      const name = "27-alliance-duel-weekly-mine";
      const lines = await reader.read(screenshot(name));
      expect(sameLines(lines, recorded(name))).toBeGreaterThanOrEqual(SAME_LINES);
      const weekly = { scope: "weekly" } as const;
      expect(parseAllianceDuelRanking(lines, weekly)).toEqual(
        parseAllianceDuelRanking(recorded(name), weekly),
      );
    },
    SLOW,
  );

  it(
    "reads a Donation page to the text and rows that were recorded",
    async () => {
      const name = "22-donation-weekly";
      const lines = await reader.read(screenshot(name));
      expect(sameLines(lines, recorded(name))).toBeGreaterThanOrEqual(SAME_LINES);
      expect(parseRanking(lines)).toEqual(parseRanking(recorded(name)));
    },
    SLOW,
  );

  it(
    "reads a Secret Operations report to the text and entries that were recorded",
    async () => {
      const name = "53-secret-ops-report";
      const lines = await reader.read(screenshot(name));
      expect(sameLines(lines, recorded(name))).toBeGreaterThanOrEqual(SAME_LINES);
      expect(parseSecretOpsReport(lines)).toEqual(parseSecretOpsReport(recorded(name)));
    },
    SLOW,
  );
});
