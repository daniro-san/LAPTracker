import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mjs|js)$/.test(entry.name) ? [path] : [];
  });
}

/** Lines of code with // comments removed, so the header's description of what is forbidden is not a hit. */
const codeLines = (file: string) =>
  readFileSync(join(root, file), "utf8")
    .split("\n")
    .map((line, i) => ({ n: i + 1, text: line.replace(/(^|\s)\/\/.*$/, "") }));

/** Built from pieces so this file is not a hit itself. */
const upstreamHost = new RegExp(["last", "asylum", "tracker"].join(""), "i");

describe("upstream location is config (plan Phase 2)", () => {
  it("names the upstream host only in the two lib/env.ts defaults", () => {
    const hits = [...sourceFiles("lib"), ...sourceFiles("app")].flatMap((file) =>
      codeLines(file)
        .filter((l) => upstreamHost.test(l.text))
        .map((l) => `${relative(root, join(root, file))}:${l.n}: ${l.text.trim()}`),
    );
    const allowed = hits.filter((h) => /^lib\/env\.ts:\d+: LAP_(API|SITE)_BASE_URL:/.test(h));
    expect(allowed).toHaveLength(2);
    expect(hits.filter((h) => !allowed.includes(h))).toEqual([]);
  });
});

describe("internal.ts is read-only (plan §3.5)", () => {
  it("has no refresh path, no write method and no Origin/Referer/cookie header in its code", () => {
    const offenders = codeLines("lib/sources/internal.ts").filter((l) =>
      /refresh|\b(POST|PUT|PATCH|DELETE)\b|origin|referer|cookie|credentials/i.test(l.text),
    );
    expect(offenders).toEqual([]);
  });
});
