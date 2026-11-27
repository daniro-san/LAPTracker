// Test-only helpers: the screenshot fixtures in fixtures/screenshots (invented names, issue 617).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "../../fixtures/screenshots");

/** The OCR text lines of `fixtures/screenshots/<name>.txt`, one line per row. */
export const recorded = (name: string): string[] =>
  readFileSync(join(dir, `${name}.txt`), "utf8")
    .split("\n")
    .filter((line) => line !== "");

export const screenshot = (name: string): Uint8Array => readFileSync(join(dir, `${name}.png`));

/** OGs' invented roster as name candidates (`roster.json`), uids from 900001 in file order. */
export function ogsCandidates(): { uid: number; names: string[] }[] {
  const names = JSON.parse(readFileSync(join(dir, "roster.json"), "utf8")) as string[];
  return names.map((name, i) => ({ uid: 900_001 + i, names: [name] }));
}
