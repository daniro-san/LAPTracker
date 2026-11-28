// What the event picture's sections share (lib/event-image.tsx, lib/event-image-turnout.tsx): the 2×
// scale, the row and section heights, the fonts, which characters the fonts can draw, and the section
// heading. The fonts and `drawable` also serve the public pages' link preview cards (lib/link-card.tsx).
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cloneElement, type ReactElement } from "react";

import type { Token } from "./brand/palette";
import type { PublicAlliance } from "./notify";

export const U = 2;
export const u = (n: number) => n * U;
export const SECTION = 36;
export const ROW = 35;

export type Colors = Record<Token, string>;

/** The brand's three fonts, committed as TTF in lib/brand/fonts/ (next/font ships WOFF2, which Satori cannot
 * read), read once. */
const FONT_FILES = [
  ["Alegreya", "Alegreya-Regular.ttf", 400],
  ["Alegreya Sans", "AlegreyaSans-Bold.ttf", 700],
  ["Source Sans 3", "SourceSans3-Regular.ttf", 400],
  ["Source Sans 3", "SourceSans3-Semibold.ttf", 600],
] as const;
let fonts: { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[] | undefined;
export const loadFonts = () =>
  (fonts ??= FONT_FILES.map(([name, file, weight]) => ({
    name,
    weight,
    style: "normal" as const,
    data: readFileSync(join(process.cwd(), "lib/brand/fonts", file)),
  })));

/**
 * Only what the loaded fonts draw (owner, 2026-11-09): other scripts (꧁ ꧂, CJK, Thai), emoji and their
 * joiners are left out, so the renderer never fetches a font or an emoji. The text keeps the full name.
 */
const UNDRAWN =
  /[^\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️|⃣/gu;
export const drawable = (text: string) => text.replace(UNDRAWN, "").replace(/\s+/g, " ").trim();

/** The tag and the name as drawn; the union id when nothing of either can be drawn. */
export function label(a: Pick<PublicAlliance, "unionId" | "tag" | "name">) {
  const tag = drawable(a.tag ?? "");
  const name = drawable(a.name ?? "");
  return { tag, name: tag || name ? name : String(a.unionId) };
}

const mark = (el: ReactElement, color: string) =>
  cloneElement(el as ReactElement<Record<string, unknown>>, {
    width: u(18),
    height: u(18),
    style: { color },
  });

export function Section({
  c,
  icon,
  color,
  text,
}: {
  c: Colors;
  icon: ReactElement;
  color: string;
  text: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: u(6),
        height: u(SECTION),
        fontFamily: "Alegreya Sans",
        fontWeight: 700,
        fontSize: u(21),
        color: c.ink,
      }}
    >
      {mark(icon, color)}
      <span>{text}</span>
    </div>
  );
}
