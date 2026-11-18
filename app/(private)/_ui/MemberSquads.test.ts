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
  heroes: [hero(10010, 60, 9, 4), hero(10005, 150, 50, 5), hero(99999, 50, 4, 3)],
  seenAt: new Date("2026-11-16T20:00:00Z"),
  readAt: new Date("2026-11-17T01:40:00Z"),
};
const NAMES = new Map([
  [10005, "Kesso"],
  [10010, "Ilvane"],
]);

const F = cardFormats("en", "Etc/GMT+2", NOW);
const EN = WORKSPACE_DICTIONARIES.en;
const only = (squads: StoredSquad[]) => squads.map((latest) => ({ latest, previous: null }));
const squad = (n: number, power: number, heroes = SQUAD.heroes): StoredSquad => ({
  ...SQUAD,
  squad: n,
  power,
  heroes,
});

function render(language: "en" | "pt-BR", squads: StoredSquad[]) {
  const t = WORKSPACE_DICTIONARIES[language];
  const card = squadsCardOf(only(squads), NAMES, t, cardFormats(language, "Etc/GMT+2", NOW));
  // React marks the joins between text parts with empty comments.
  return renderToStaticMarkup(createElement(MemberSquads, { squads: card })).replaceAll(
    "<!-- -->",
    "",
  );
}

describe("the member card's squads (D117)", () => {
  it("shows each squad's might, when it was seen, and its heroes with picture, level and stars", () => {
    const html = render("en", [SQUAD]);
    expect(html).toContain("Squads (from the tracker)");
    expect(html).toContain("Squad 2");
    expect(html).toContain("Might 61.2M");
    expect(html).toContain("seen Mon, Nov 16");
    // UR (q 5) first, then SSR (q 4), then R; floor(50 / 5) = 10 stars, shown as one star and the count.
    expect(html.indexOf("Kesso")).toBeLessThan(html.indexOf("Ilvane"));
    expect(html.indexOf(">UR<")).toBeLessThan(html.indexOf(">SSR<"));
    expect(html.indexOf(">SSR<")).toBeLessThan(html.indexOf(">R<"));
    expect(html).toContain('src="/img/hero/10005"');
    expect(html).toContain("Lv 150");
    expect(html).toContain('aria-label="10 stars">★10<');
    expect(html).toContain('aria-label="1 star">★1<');
    // 99999 is not in the catalog: a plain box and "Unknown hero", never a picture request.
    expect(html).toContain("Unknown hero");
    expect(html).not.toContain("/img/hero/99999");
  });

  it("speaks Portuguese, and says the tracker has seen none in one line", () => {
    const html = render("pt-BR", [SQUAD]);
    expect(html).toContain("Esquadrões (do tracker)");
    expect(html).toContain("Esquadrão 2");
    expect(html).toContain("Nv 150");
    expect(html).toContain('aria-label="10 estrelas"');
    expect(render("en", [])).toContain("The tracker has not seen their squads yet.");
    expect(render("en", [])).not.toContain("<img");
  });

  it("marks one strongest squad, the lower number on a tie, and lists all four in squad order", () => {
    const squads = [
      squad(3, 8_000_000),
      squad(4, 12_000_000),
      squad(1, 10_000_000),
      squad(2, 12_000_000),
    ];
    const card = squadsCardOf(only(squads), NAMES, EN, F);
    expect(card.squads.map((s) => [s.squad, s.strongest])).toEqual([
      [1, false],
      [2, true],
      [3, false],
      [4, false],
    ]);
    const html = render("en", squads);
    expect(html.split(">Strongest<")).toHaveLength(2);
  });

  it("marks one top hero: rarity first, then stars, then level", () => {
    const card = squadsCardOf(
      only([
        // An SSR with every star loses to any UR.
        squad(1, 10_000_000, [hero(10010, 150, 50, 4)]),
        // Two URs with the same stars: the higher level wins.
        squad(2, 9_000_000, [hero(10005, 10, 20, 5), hero(10021, 90, 20, 5)]),
        squad(3, 8_000_000, [hero(10033, 140, 15, 5)]),
      ]),
      NAMES,
      EN,
      F,
    );
    const tops = card.squads.flatMap((s) =>
      s.heroes.filter((h) => h.top).map((h) => [s.squad, h.id]),
    );
    expect(tops).toEqual([[2, 10021]]);
    expect(card.topRule).toContain("UR, then SSR, then R");
  });

  it("says what changed since the row before, and nothing when there is none", () => {
    const before: StoredSquad = {
      ...squad(1, 10_000_000),
      heroes: [hero(10005, 149, 50, 5)],
      seenAt: new Date("2026-11-15T20:00:00Z"),
    };
    const after = { ...squad(1, 11_200_000), heroes: [hero(10005, 150, 50, 5)] };
    const [grew] = squadsCardOf([{ latest: after, previous: before }], NAMES, EN, F).squads;
    expect(grew).toMatchObject({
      change: "+1.20M since Sun, Nov 15",
      heroesChanged: "Heroes changed",
    });
    // The same heroes say nothing; a drop is said the same way, with a minus and no warning.
    const higher = { ...before, power: 10_400_000 };
    const [rose] = squadsCardOf([{ latest: higher, previous: before }], NAMES, EN, F).squads;
    expect(rose).toMatchObject({ change: "+400K since Sun, Nov 15", heroesChanged: null });
    const [lower] = squadsCardOf([{ latest: before, previous: higher }], NAMES, EN, F).squads;
    expect(lower?.change).toBe("−400K since Sun, Nov 15");
    const [first] = squadsCardOf(only([after]), NAMES, EN, F).squads;
    expect(first).toMatchObject({ change: null, heroesChanged: null });
  });
});
