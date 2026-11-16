// Neutralises the roster keys that must never reach the public repository (D76) in a recorded upstream body.
// Keys stay, values become neutral of the same JSON type: numbers 0, booleans false, strings "", null stays null.
// Text in, text out: bytes outside those values (spacing, 0.0 floats, key order) are left as returned.
//   stdin -> stdout:  tsx scripts/neutralise-fixture.ts < raw.json > fixtures/<kind>/<name>.json
//   in place:         tsx scripts/neutralise-fixture.ts fixtures/a.json fixtures/b.json
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const NEUTRALISED_KEYS: ReadonlySet<string> = new Set([
  "x",
  "y",
  "online",
  "last_online_at",
  "joined_at",
]);

const STRING = String.raw`"(?:[^"\\]|\\.)*"`;
// A string, and when a primitive value follows a colon, that value. Strings are consumed whole, so a key-like
// text inside a string value is never matched as a key.
const KEY_VALUE = new RegExp(
  `"((?:[^"\\\\]|\\\\.)*)"(?:(\\s*:\\s*)(null|true|false|-?[0-9][0-9.eE+-]*|${STRING}))?`,
  "g",
);

function neutralValue(value: string): string {
  if (value === "null") return "null";
  if (value === "true" || value === "false") return "false";
  return value.startsWith('"') ? '""' : "0";
}

export function neutraliseFixture(text: string): string {
  return text.replace(
    KEY_VALUE,
    (match, key: string, colon: string | undefined, value: string | undefined) =>
      colon === undefined || value === undefined || !NEUTRALISED_KEYS.has(key)
        ? match
        : `"${key}"${colon}${neutralValue(value)}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    process.stdout.write(neutraliseFixture(readFileSync(0, "utf8")));
  } else {
    for (const file of files) writeFileSync(file, neutraliseFixture(readFileSync(file, "utf8")));
  }
}
