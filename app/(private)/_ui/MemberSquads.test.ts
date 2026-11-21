// The member card's "Squads (from the tracker)" (D117, D136): each squad's might and when it was seen, its
// heroes in the game's slot order with picture, name, SR/SSR/UR, the game's star icons and Hall of Honor
// level, a neutral empty slot, a plain box for a hero outside the catalog, and one quiet line when the
// tracker has seen no squad. Invented values.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { cardFormats } from "@/lib/private/member-card";
import { squadsCardOf, starIcons, type StoredSquad } from "@/lib/private/member-squads";

import { MemberSquads } from "./MemberSquads";

const NOW = new Date("2026-11-17T12:00:00Z");
const hero = (id: number, lv: number, star: number, q: number, honor?: number) => ({
  id,
  lv,
  star,
  q,
  awaken: 0,
  ...(honor === undefined ? {} : { honor }),
});
const SQUAD: StoredSquad = {
  uid: 7,
  squad: 2,
  power: 61_234_567,
  soldiers: 4000,
  soldierLoad: 3800,
  heroes: [hero(10010, 60, 9, 4, 42), hero(10005, 150, 50, 5, 0), hero(99999, 50, 4, 3)],
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
  it("shows each squad's might, when it was seen on the server clock, and its heroes with picture, level and stars", () => {
    const html = render("en", [SQUAD]);
    expect(html).toContain("Squads (from the tracker)");
    expect(html).toContain("1 squad seen · last Mon, Nov 16");
    expect(html).toContain("Squad 2");
    expect(html).toContain("Might 61.2M");
    // 20:00 UTC is 18:00 on the server's clock (UTC−2).
    expect(html).toContain("seen Mon, Nov 16 18:00 ST");
    // How old the sighting is when the card is made (the page is made at 12:00 UTC on the 17th).
    expect(html).toMatch(/ · (<span[^>]*>)?16\sh ago/);
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

  it("keeps the API's order as the game's slot order, fills 5 slots, and says an empty one plainly", () => {
    const [card] = squadsCardOf(only([SQUAD]), NAMES, EN, F).squads;
    expect(card?.slots.map((h) => h?.id ?? null)).toEqual([10010, 10005, 99999, null, null]);
    // Hall of Honor 0 (most heroes) says nothing, like a row stored before honor was kept.
    expect(card?.slots.map((h) => h?.honor ?? null)).toEqual(["Honor 42", null, null, null, null]);
    expect(card?.empty).toBe("2 slots empty");
    const html = render("en", [SQUAD]);
    // The lineup is hidden from screen readers; the list in slot order is read instead.
    expect(html).toContain('aria-hidden="true" class="mt-2 grid');
    const list = html.slice(html.indexOf("<ol"));
    expect(list.indexOf("Slot 1:")).toBeLessThan(list.indexOf("Ilvane"));
    expect(list.indexOf("Ilvane")).toBeLessThan(list.indexOf("Kesso"));
    expect(list).toContain("Slot 5:");
    expect(list).toContain("Empty slot");
    expect(html).not.toMatch(/soldier|troop/i);
  });

  it("puts slots 1–2 in the front row on top and 3–5 in the back row below, at every width", () => {
    const five = [10001, 10002, 10003, 10004, 10005];
    const names = new Map(five.map((id) => [id, `Hero ${id}`]));
    const full = squad(
      1,
      1,
      five.map((id) => hero(id, 100, 25, 5)),
    );
    const card = squadsCardOf(only([full]), names, EN, F);
    const html = renderToStaticMarkup(createElement(MemberSquads, { squads: card }));
    const lineup = html.slice(html.indexOf('aria-hidden="true"'), html.indexOf("<ol"));
    // Each slot's grid place: no breakpoint classes, so the phone and the desktop draw the same rows.
    const place = (id: number) =>
      lineup
        .slice(0, lineup.indexOf(`src="/img/hero/${id}"`))
        .match(/col-start-\d row-start-\d/g)
        ?.at(-1);
    expect(five.map(place)).toEqual([
      "col-start-2 row-start-1",
      "col-start-4 row-start-1",
      "col-start-1 row-start-2",
      "col-start-3 row-start-2",
      "col-start-5 row-start-2",
    ]);
    expect(lineup).not.toMatch(/\b(min-\[|sm:|md:|lg:)/);
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
      squadsCardOf(only([squad(1, 1, [hero(10005, 1, star, 5)])]), NAMES, EN, F).squads[0]?.slots[0]
        ?.starsLabel;
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
