// docs/DESIGN.md "Enforcement": lib/brand/tokens.css is the only place a colour literal appears.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOTS = ["app", "lib/brand/components"];
const LITERAL = /#[0-9a-f]{3,6}\b|rgba?\(/i;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(dir, e.name))
      : /\.(tsx?|css)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

describe("colour literals", () => {
  it("appear only in lib/brand/tokens.css, never in app/ or lib/brand/components/", () => {
    const hits = ROOTS.flatMap(files).flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .flatMap((line, i) => (LITERAL.test(line) ? [`${f}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(hits).toEqual([]);
  });
});
