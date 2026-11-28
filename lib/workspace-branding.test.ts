// A workspace's branding (issue 462, D167): every accent keeps the header's wax-paper text at 4.5:1 or more in
// light and dark, a tab title is plain text capped at 40 characters, and a webhook message posts as the title
// and the icon, through our own address.
import { describe, expect, it } from "vitest";

import { accentColor } from "./brand/palette";
import {
  ACCENTS,
  cleanTitle,
  iconPath,
  lookOf,
  TITLE_LIMIT,
  titleLength,
} from "./workspace-branding";

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

/** The header's text, the same ivory in light and dark (--wax-paper in tokens.css). */
const WAX_PAPER = "#efe6d3";

describe("the accent palette", () => {
  it("offers six colours and each passes 4.5:1 under the header's text, light and dark", () => {
    expect(ACCENTS).toHaveLength(6);
    for (const accent of ACCENTS)
      for (const mode of ["light", "dark"] as const)
        expect(
          contrast(accentColor(accent, mode), WAX_PAPER),
          `${accent} ${mode}`,
        ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the header's subtitle", () => {
  it("passes 4.5:1 at the opacity the header draws it, on every accent, light and dark", () => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const OPACITY = 0.9;
    for (const accent of ACCENTS)
      for (const mode of ["light", "dark"] as const) {
        const bg = accentColor(accent, mode);
        const text = rgb(WAX_PAPER).map((v, i) => v * OPACITY + (rgb(bg)[i] ?? 0) * (1 - OPACITY));
        const blended = `#${text.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
        expect(contrast(blended, bg), `${accent} ${mode}`).toBeGreaterThanOrEqual(4.5);
      }
  });
});

describe("the tab title", () => {
  it("is plain text on one line: no angle brackets, hidden or control characters", () => {
    expect(cleanTitle("  [ZZZ]\n  Desk​ <i>now</i> ")).toBe("[ZZZ] Desk inow/i");
    expect(cleanTitle("   ")).toBe("");
  });

  it("counts characters as people see them, so an emoji is one", () => {
    expect(TITLE_LIMIT).toBe(40);
    expect(titleLength("👩‍👩‍👧‍👦".repeat(40))).toBe(40);
  });
});

describe("what a webhook message posts as", () => {
  const b = { title: "[ZZZ] Desk", icon: "mark", badgeId: 101, discordIconHash: null } as const;

  it("is the title and an avatar on our own address, nothing of Discord's CDN", () => {
    const look = lookOf({ ...b, icon: "badge" }, "zzz", "https://laptracker.test");
    expect(look).toEqual({
      username: "[ZZZ] Desk",
      avatar_url: "https://laptracker.test/img/desk/zzz?size=512&v=badge-101",
    });
    expect(lookOf(b, "zzz", "https://laptracker.test").avatar_url).toBe(
      "https://laptracker.test/icon/512",
    );
    expect(iconPath({ ...b, icon: "discord", discordIconHash: "d".repeat(32) }, "zzz", 192)).toBe(
      `/img/desk/zzz?size=192&v=discord-${"d".repeat(32)}`,
    );
  });

  it("leaves out a title over 80 code points instead of cutting it", () => {
    expect(lookOf({ ...b, title: "x".repeat(80) }, "zzz").username).toBe("x".repeat(80));
    expect(lookOf({ ...b, title: "x".repeat(81) }, "zzz").username).toBeUndefined();
    // 41 emoji are 82 UTF-16 units but 41 code points: fine.
    expect(lookOf({ ...b, title: "😀".repeat(41) }, "zzz").username).toBe("😀".repeat(41));
  });

  it("changes the icon's address with the choice and the hash, so a cached copy is not reused", () => {
    const a = iconPath({ ...b, icon: "discord", discordIconHash: "1".repeat(32) }, "zzz", 192);
    const c = iconPath({ ...b, icon: "discord", discordIconHash: "2".repeat(32) }, "zzz", 192);
    expect(a).not.toBe(c);
    expect(iconPath({ ...b, icon: "badge" }, "zzz", 192)).not.toBe(a);
  });

  it("leaves out a name Discord refuses, and the avatar when there is no address", () => {
    expect(lookOf({ ...b, title: "My Discord crew" }, "zzz")).toEqual({});
    expect(lookOf({ ...b, title: "clyde" }, "zzz", "https://x.test")).toEqual({
      avatar_url: "https://x.test/icon/512",
    });
  });
});
