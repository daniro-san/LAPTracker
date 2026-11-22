// docs/DESIGN.md "Enforcement": lib/brand/tokens.css is the only place a colour literal appears. ESLint checks
// the .ts and .tsx files (no-restricted-syntax in eslint.config.mjs); it does not parse CSS, so this test checks
// the stylesheets under app/ and lib/brand/components/, with their /* comments */ removed.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOTS = ["app", "lib/brand/components"];
const LITERAL = /#[0-9a-f]{3,6}\b|rgba?\(/i;

function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? stylesheets(join(dir, e.name))
      : e.name.endsWith(".css")
        ? [join(dir, e.name)]
        : [],
  );
}

/** The file's lines with comments blanked, so line numbers still match the file. */
const codeLines = (file: string) =>
  readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .split("\n");

describe("colour literals in stylesheets", () => {
  it("appear only in lib/brand/tokens.css, never in a stylesheet under app/ or lib/brand/components/", () => {
    const files = ROOTS.flatMap(stylesheets);
    expect(files).toContain("app/globals.css");
    const hits = files.flatMap((f) =>
      codeLines(f).flatMap((line, i) =>
        LITERAL.test(line) ? [`${f}:${i + 1}: ${line.trim()}`] : [],
      ),
    );
    expect(
      hits,
      "Colour literal outside lib/brand/tokens.css (docs/DESIGN.md, Enforcement). Use var(--token) or color-mix() with a token; a new colour goes in lib/brand/tokens.css.",
    ).toEqual([]);
  });
});
