// The member card's "Squads (from the tracker)" (D117): each squad's might and "seen" date, its heroes in
// the site's order with picture, name, level and whole stars, a plain box for a hero outside the catalog,
// and one quiet line when the tracker has seen no squad. Invented values.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { cardFormats } from "@/lib/private/member-card";
import { squadsCardOf, type StoredSquad } from "@/lib/private/member-squads";

import { MemberSquads } from "./MemberSquads";

const NOW = new Date("2026-11-17T12:00:00Z");
const hero = (id: number, lv: number, star: number, q: number) => ({ id, lv, star, q, awaken: 0 });
const SQUAD: StoredSquad = {
  uid: 7,
  squad: 2,
  power: 61_234_567,
  soldiers: 4000,
  soldierLoad: 3800,
  heroes: [hero(10010, 60, 9, 4), hero(10005, 80, 22, 5), hero(99999, 50, 4, 3)],
  seenAt: new Date("2026-11-16T20:00:00Z"),
  readAt: new Date("2026-11-17T01:40:00Z"),
};
const NAMES = new Map([
  [10005, "Kesso"],
  [10010, "Ilvane"],
]);

function render(language: "en" | "pt-BR", squads: StoredSquad[]) {
  const t = WORKSPACE_DICTIONARIES[language];
  const card = squadsCardOf(squads, NAMES, t, cardFormats(language, "Etc/GMT+2", NOW));
  return renderToStaticMarkup(createElement(MemberSquads, { squads: card }));
}

describe("the member card's squads (D117)", () => {
  it("shows each squad's might, when it was seen, and its heroes with picture, level and stars", () => {
    const html = render("en", [SQUAD]);
    expect(html).toContain("Squads (from the tracker)");
    expect(html).toContain("Squad 2");
    expect(html).toContain("Might 61.2M");
    expect(html).toContain("seen Mon, Nov 16");
    // Legendary (q 5) first, then epic; floor(22 / 5) = 4 stars.
    expect(html.indexOf("Kesso")).toBeLessThan(html.indexOf("Ilvane"));
    expect(html).toContain('src="/img/hero/10005"');
    expect(html).toContain("Lv 80");
    expect(html).toContain('aria-label="4 stars"');
    expect(html).toContain("★★★★<");
    // 99999 is not in the catalog: a plain box and "Unknown hero", never a picture request.
    expect(html).toContain("Unknown hero");
    expect(html).not.toContain("/img/hero/99999");
  });

  it("speaks Portuguese, and says the tracker has seen none in one line", () => {
    const html = render("pt-BR", [SQUAD]);
    expect(html).toContain("Esquadrões (do tracker)");
    expect(html).toContain("Esquadrão 2");
    expect(html).toContain("Nv 80");
    expect(html).toContain('aria-label="4 estrelas"');
    expect(render("en", [])).toContain("The tracker has not seen their squads yet.");
    expect(render("en", [])).not.toContain("<img");
  });
});
