// Test-only helpers: the screenshots in fixtures/screenshots and the text the real OCR recorded from them.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "../../fixtures/screenshots");

/** The OCR text lines recorded from `fixtures/screenshots/<name>.png` (recorded by read-screenshot.ts). */
export const recorded = (name: string): string[] =>
  readFileSync(join(dir, `${name}.txt`), "utf8")
    .split("\n")
    .filter((line) => line !== "");

export const screenshot = (name: string): Uint8Array => readFileSync(join(dir, `${name}.png`));

/** The OGs roster as name candidates: `members[].uid` and `nick_name` of the 2026-11-16 read. */
export function ogsCandidates(): { uid: number; names: string[] }[] {
  const body = JSON.parse(
    readFileSync(
      join(import.meta.dirname, "../../fixtures/v1-20261116T105019Z/alliance-67111155.json"),
      "utf8",
    ),
  ) as { members: { uid: number; nick_name: string }[] };
  return body.members.map((m) => ({ uid: m.uid, names: [m.nick_name] }));
}
