// Translation freshness (D48), a step of `pnpm check`. Each language keeps, per key, the hash of the
// English text it was translated from (lib/i18n/<tag>.stamps.json). A key is missing (not translated),
// stale (English changed since, or never stamped), extra (not in English) or broken (placeholders differ).
//   tsx scripts/i18n-check.ts          report; exit 1 if any language needs work
//   tsx scripts/i18n-check.ts --todo   the work as JSON, for the translate-copy skill
//   tsx scripts/i18n-check.ts --stamp  mark every translated key fresh against today's English; run only
//                                      after the translators updated every key --todo listed
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { en } from "../lib/copy";
import { TRANSLATIONS } from "../lib/i18n";

type Tree = { readonly [key: string]: string | Tree };

/** `{ "status.next": "Next update at {time}" }`. */
function flat(tree: Tree, path = ""): Map<string, string> {
  return new Map(
    Object.entries(tree).flatMap(([key, value]) => {
      const at = path ? `${path}.${key}` : key;
      return typeof value === "string" ? [[at, value] as const] : [...flat(value, at)];
    }),
  );
}

const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 8);
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(" ");
const stampsPath = (tag: string) => `lib/i18n/${tag}.stamps.json`;

function readStamps(tag: string): Record<string, string> {
  const path = stampsPath(tag);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, string>) : {};
}

const english = flat(en);

interface Work {
  missing: string[];
  stale: string[];
  extra: string[];
  broken: string[];
}

function audit(tag: string, translation: Tree): Work {
  const mine = flat(translation);
  const stamps = readStamps(tag);
  const work: Work = { missing: [], stale: [], extra: [], broken: [] };
  for (const [key, text] of english) {
    const value = mine.get(key);
    if (value === undefined) work.missing.push(key);
    else if (placeholders(value) !== placeholders(text)) work.broken.push(key);
    else if (stamps[key] !== hash(text)) work.stale.push(key);
  }
  work.extra = [...mine.keys()].filter((key) => !english.has(key));
  return work;
}

const languages = Object.entries(TRANSLATIONS).map(([tag, t]) => ({ tag, tree: t as Tree }));
const mode = process.argv[2];

if (mode === "--todo") {
  // Per language: the English text of every key to (re)translate, and the current translation if any.
  const todo = Object.fromEntries(
    languages.flatMap(({ tag, tree }) => {
      const { missing, stale, broken } = audit(tag, tree);
      const keys = [...missing, ...stale, ...broken];
      if (keys.length === 0) return [];
      const mine = flat(tree);
      const entries = keys.map((key) => [key, { en: english.get(key), current: mine.get(key) }]);
      return [[tag, Object.fromEntries(entries)]];
    }),
  );
  console.log(JSON.stringify(todo, null, 2));
} else if (mode === "--stamp") {
  for (const { tag, tree } of languages) {
    const mine = flat(tree);
    const stamps = Object.fromEntries(
      [...english].filter(([key]) => mine.has(key)).map(([key, text]) => [key, hash(text)]),
    );
    writeFileSync(stampsPath(tag), `${JSON.stringify(stamps, null, 2)}\n`);
  }
  console.log(`i18n: stamped ${languages.length} languages`);
} else {
  const report = languages
    .map(({ tag, tree }) => ({ tag, work: audit(tag, tree) }))
    .filter(({ work }) => Object.values(work).some((keys) => keys.length > 0));
  if (report.length === 0) {
    console.log(`i18n: ${languages.length} languages up to date with English`);
  } else {
    for (const { tag, work } of report) {
      const parts = Object.entries(work)
        .filter(([, keys]) => keys.length > 0)
        .map(([kind, keys]) => `${kind} ${keys.join(", ")}`);
      console.error(`i18n ${tag}: ${parts.join("; ")}`);
    }
    console.error(
      `i18n: ${report.length} language(s) out of date with lib/copy.ts. Run the translate-copy skill (.claude/skills/translate-copy/SKILL.md).`,
    );
    process.exit(1);
  }
}
