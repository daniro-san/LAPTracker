// Every user-facing string lives in lib/copy.ts (docs/DESIGN.md "Language-light rules"). This test parses
// every .tsx file under app/ and fails on JSX text, or a string prop, of more than two words: such text
// belongs in copy. Numbers, punctuation, symbols and class names are not words.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { blankCopy, blankDictionary, copy, en, fill } from "./copy";
import { de } from "./copy.de";
import { es } from "./copy.es";
import { fr } from "./copy.fr";
import { idID } from "./copy.id";
import { itIT } from "./copy.it";
import { ja } from "./copy.ja";
import { ko } from "./copy.ko";
import { nl } from "./copy.nl";
import { pl } from "./copy.pl";
import { ptBR } from "./copy.pt-BR";
import { ru } from "./copy.ru";
import { sv } from "./copy.sv";
import { th } from "./copy.th";
import { tr } from "./copy.tr";
import { uk } from "./copy.uk";
import { vi } from "./copy.vi";
import { zhCN } from "./copy.zh-CN";

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

/** Every key path with its placeholders, sorted: `status.next {time}`. */
function shape(value: unknown, path = ""): string[] {
  if (typeof value === "string")
    return [`${path} ${(value.match(/\{\w+\}/g) ?? []).sort().join("")}`];
  return Object.entries(value as object).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
}

describe("dictionaries", () => {
  it.each([
    ["es", es],
    ["pt-BR", ptBR],
    ["fr", fr],
    ["de", de],
    ["it", itIT],
    ["nl", nl],
    ["sv", sv],
    ["pl", pl],
    ["ru", ru],
    ["uk", uk],
    ["tr", tr],
    ["zh-CN", zhCN],
    ["ja", ja],
    ["ko", ko],
    ["id", idID],
    ["vi", vi],
    ["th", th],
  ])("%s has the English keys and placeholders and keeps the game's own terms", (_, dictionary) => {
    expect(shape(dictionary)).toEqual(shape(en));
    const { might, kills, members, level } = dictionary.ledger;
    expect([might, kills, members, level]).toEqual(["Might", "Kills", "Members", "Level"]);
  });
});
