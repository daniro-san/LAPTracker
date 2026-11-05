// Token values for places that cannot read CSS variables: the generated icons, the Open Graph image,
// the web manifest and the colour table on /brand. Read from tokens.css so that file stays the only
// colour source (DESIGN.md "Enforcement"). Read from the project root.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const TOKENS = ["paper", "ink", "plum", "seal", "yarn", "sage", "rule"] as const;
export type Token = (typeof TOKENS)[number];
export type Mode = "light" | "dark";

// Light is the first :root block; dark is the data-theme block (the media-query block repeats it).
const BLOCK: Record<Mode, string> = { light: ":root {", dark: ':root[data-theme="dark"] {' };

export function tokenColor(name: Token, mode: Mode = "light"): string {
  const css = readFileSync(join(process.cwd(), "lib/brand/tokens.css"), "utf8");
  const start = css.indexOf(BLOCK[mode]);
  const block = css.slice(start, css.indexOf("}", start));
  const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`).exec(block)?.[1];
  if (start < 0 || !value) throw new Error(`token --${name} (${mode}) not found in tokens.css`);
  return value;
}
