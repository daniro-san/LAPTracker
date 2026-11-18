// The member card's "Squads (from the tracker)" (D117): each squad's might and "seen" date, its heroes in
// the site's order with picture, name, SR/SSR/UR and the game's star icons, a plain box for a hero outside the catalog,
// and one quiet line when the tracker has seen no squad. Invented values.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { cardFormats } from "@/lib/private/member-card";
import { squadsCardOf, starIcons, type StoredSquad } from "@/lib/private/member-squads";

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
    // UR (q 5) first, then SSR (q 4), then SR (q 3), each tag in its game colour.
    expect(html.indexOf("Kesso")).toBeLessThan(html.indexOf("Ilvane"));
    expect(html.indexOf(">UR<")).toBeLessThan(html.indexOf(">SSR<"));
    expect(html.indexOf(">SSR<")).toBeLessThan(html.indexOf(">SR<"));
    expect(html).toContain('class="font-semibold text-rarity-ur">UR<');
    expect(html).toContain('class="font-semibold text-rarity-sr">SR<');
    expect(html).toContain('src="/img/hero/10005"');
    expect(html).toContain("Lv 150");
    // star 50 is level 10; star 4 is level 0 with a part of the first star.
    expect(html).toContain('aria-label="Star level 10 of 10"');
    expect(html).toContain('aria-label="Star level 0 of 10"');
    // 99999 is not in the catalog: a plain box and "Unknown hero", never a picture request.
    expect(html).toContain("Unknown hero");
    expect(html).not.toContain("/img/hero/99999");
  });

  it("speaks Portuguese, and says the tracker has seen none in one line", () => {
    const html = render("pt-BR", [SQUAD]);
    expect(html).toContain("Esquadrões (do tracker)");
    expect(html).toContain("Esquadrão 2");
    expect(html).toContain("Nv 150");
    expect(html).toContain('aria-label="Nível de estrela 10 de 10"');
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

  it("draws the game's five stars: yellow for levels 1–5, red from the left for 6–10, the next one in part", () => {
    const look = (star: number) =>
      starIcons(star).map((i) => (i.next ? `${i.base}+${i.next}:${i.part}` : i.base));
    expect(look(0)).toEqual(["empty", "empty", "empty", "empty", "empty"]);
    // 22: level 4, and 2 of the 5 steps toward level 5 fill the fifth star in yellow.
    expect(look(22)).toEqual(["yellow", "yellow", "yellow", "yellow", "empty+yellow:0.4"]);
    expect(look(25)).toEqual(["yellow", "yellow", "yellow", "yellow", "yellow"]);
    // 35: level 7, two red then three yellow.
    expect(look(35)).toEqual(["red", "red", "yellow", "yellow", "yellow"]);
    expect(look(50)).toEqual(["red", "red", "red", "red", "red"]);
    const label = (star: number) =>
      squadsCardOf(only([squad(1, 1, [hero(10005, 1, star, 5)])]), NAMES, EN, F).squads[0]
        ?.heroes[0]?.starsLabel;
    expect([0, 22, 25, 35, 50].map(label)).toEqual([
      "Star level 0 of 10",
      "Star level 4 of 10",
      "Star level 5 of 10",
      "Star level 7 of 10",
      "Star level 10 of 10",
    ]);
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
