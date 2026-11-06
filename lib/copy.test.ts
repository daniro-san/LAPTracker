// Every user-facing string lives in lib/copy.ts (docs/DESIGN.md "Language-light rules"). This test parses
// every .tsx file under app/ and fails on JSX text, or a string prop, of more than two words: such text
// belongs in copy. Numbers, punctuation, symbols and class names are not words.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { blankCopy, blankDictionary, copy, en, fill } from "./copy";
import { TRANSLATIONS } from "./i18n";

const ROOT = join(import.meta.dirname, "..");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return tsxFiles(path);
    return e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [path] : [];
  });
}

/** Words are runs that contain a letter; "12:01", "·", "→" and "#3" are not. */
const wordCount = (text: string) => text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;

const SKIPPED_PROPS = new Set(["className", "href", "key", "id", "type", "name", "inputMode"]);

function textOf(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node))
    return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(" ");
  return null;
}

/** An element's own text: its JSX text and `{"…"}` children joined, so `Showing {n} of {m} rows` counts
 * as one sentence. */
function childText(children: ts.NodeArray<ts.JsxChild>): string {
  return children
    .map((c) => {
      if (ts.isJsxText(c)) return c.text;
      return ts.isJsxExpression(c) && c.expression ? (textOf(c.expression) ?? " ") : " ";
    })
    .join("");
}

/** The user-facing text a node carries: an element's text, or a string prop (not a class name). */
function textAt(node: ts.Node, source: ts.SourceFile): string | null {
  if (ts.isJsxElement(node) || ts.isJsxFragment(node)) return childText(node.children).trim();
  if (ts.isJsxAttribute(node)) {
    if (SKIPPED_PROPS.has(node.name.getText(source))) return null;
    const init = node.initializer;
    const value = init && ts.isJsxExpression(init) ? init.expression : init;
    return value ? textOf(value) : null;
  }
  return null;
}

function literalsIn(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const hits: string[] = [];
  const visit = (node: ts.Node) => {
    const text = textAt(node, source);
    if (text !== null && wordCount(text) > 2) hits.push(text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

describe("copy", () => {
  it("app/ has no JSX text or string prop longer than two words", () => {
    const hits = tsxFiles(join(ROOT, "app")).flatMap((f) =>
      literalsIn(f).map((h) => `${relative(ROOT, f)}: ${h}`),
    );
    expect(hits).toEqual([]);
  });

  it("blank mode keeps length, spaces and placeholders and hides every letter", () => {
    const blank = blankCopy({ a: "Last updated {time}", b: { c: "Kills" } });
    expect(blank).toEqual({ a: "░░░░ ░░░░░░░ {time}", b: { c: "░░░░░" } });
    expect(fill(blank.a, { time: "12:01" })).toBe("░░░░ ░░░░░░░ 12:01");
    expect(copy.ledger.might).toBe("Might");
  });

  it("blank dictionary keeps only the game's own terms readable", () => {
    const blank = blankDictionary(copy);
    const l = blank.ledger;
    expect([l.might, l.kills, l.members, l.level]).toEqual(["Might", "Kills", "Members", "Level"]);
    expect(l.details).toBe("░░░░░░░");
    expect(blank.status.running).toBe("░░░░░░░░ ░░░");
  });
});

/** Every key path a translation has, with its placeholders, sorted: `status.next {time}`. */
function shape(value: unknown, path = ""): Map<string, string> {
  if (typeof value === "string")
    return new Map([[path, (value.match(/\{\w+\}/g) ?? []).sort().join("")]]);
  return new Map(
    Object.entries(value as object).flatMap(([k, v]) => [...shape(v, path ? `${path}.${k}` : k)]),
  );
}

describe("translations", () => {
  const english = shape(en);
  it.each(Object.entries(TRANSLATIONS))(
    "%s keeps every placeholder and the game's own terms",
    (tag, translation) => {
      for (const [key, placeholders] of shape(translation)) {
        expect(`${key} ${placeholders}`).toBe(`${key} ${english.get(key)}`);
      }
      // The game's own word from the glossary's "Game terms (from the game)" table, else English (D52).
      const glossary = readFileSync(join(ROOT, "lib/i18n/glossary", `${tag}.md`), "utf8");
      const sourced = new Map(
        [
          ...(glossary.split("## Game terms (from the game)")[1] ?? "").matchAll(
            /^\|\s*(\w+)\s*\|([^|]+)\|/gm,
          ),
        ].map(([, english, word]) => [english, word?.trim()]),
      );
      const l = translation.ledger ?? {};
      for (const term of ["might", "kills", "members", "level"] as const) {
        if (l[term] !== undefined)
          expect(l[term]).toBe(sourced.get(en.ledger[term]) ?? en.ledger[term]);
      }
    },
  );
});
