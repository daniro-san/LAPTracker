// D71's fence, the test half: the roster fields kept for the workspace are read only where D71 allows.
// The snake_case names are matched as a property, a key or a string. x, y and active are matched only as
// string literals ("x", `raw["active"]`, a key list): as `.x` or `active:` they are everyday drawing,
// date and CSS code, so a textual scan cannot tell them from a roster read.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const NAMED = ["online", "last_online_at", "joined_at", "daily_honor", "daily_tech"];
const SHORT = ["x", "y", "active"];

/** lib/repo (storage), lib/private (the workspace), the collector and raw_json trimming, and the list. */
const ALLOWED = [
  /^lib\/repo\//,
  /^lib\/private\//,
  /^lib\/collector[\w-]*\.ts$/,
  /^lib\/raw-json\.ts$/,
  /^lib\/queries\/blocked-keys\.ts$/,
  // The fixture neutraliser names the keys only to overwrite them before a body is written (D76).
  /^scripts\/neutralise-fixture\.ts$/,
];

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`;
    if (e.isDirectory()) return sources(path);
    return /\.(ts|tsx|mjs)$/.test(e.name) && !/\.test(-helpers)?\.ts$/.test(e.name) ? [path] : [];
  });
}

const named = (key: string) => new RegExp(`(\\.${key}\\b|\\b${key}\\s*:|["'\`]${key}["'\`])`);
const literal = (key: string) => new RegExp(`["'\`]${key}["'\`]`);

describe("roster fields kept for the workspace (D71)", () => {
  it("are read only in lib/repo, lib/private, the collector and raw_json trimming", () => {
    const files = ["app", "lib", "config", "scripts"].flatMap(sources).concat("proxy.ts");
    expect(files.length).toBeGreaterThan(100);
    // What reaches PostHog (D77) is scanned like the rest, never allowed.
    expect(files).toEqual(
      expect.arrayContaining([
        "lib/analytics/events.ts",
        "lib/analytics/ingest.ts",
        "lib/analytics/posthog.ts",
        "lib/analytics/region.ts",
        "lib/analytics/sanitise.ts",
        "app/_ui/PostHogAnalytics.tsx",
        "app/ingest/[...path]/route.ts",
      ]),
    );
    const offenders = files
      .filter((f) => !ALLOWED.some((a) => a.test(relative(".", f))))
      .flatMap((f) => {
        // Comments may name a field ("reading 'x'"); only code counts.
        const source = readFileSync(join(ROOT, f), "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        const hits = [
          ...NAMED.filter((k) => named(k).test(source)),
          ...SHORT.filter((k) => literal(k).test(source)),
        ];
        return hits.map((k) => `${f}: ${k}`);
      });
    expect(offenders).toEqual([]);
  });
});
