// Light-mode token values for places that cannot read CSS variables: the generated icons, the Open
// Graph image and the web manifest. Read from tokens.css so that file stays the only colour source
// (DESIGN.md "Enforcement"). These routes are rendered at build time, from the project root.
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Token = "paper" | "ink" | "plum" | "seal" | "yarn" | "sage" | "rule";

export function tokenColor(name: Token): string {
  const css = readFileSync(join(process.cwd(), "lib/brand/tokens.css"), "utf8");
  const root = css.slice(css.indexOf(":root {"), css.indexOf("}"));
  const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`).exec(root)?.[1];
  if (!value) throw new Error(`token --${name} not found in tokens.css`);
  return value;
}
