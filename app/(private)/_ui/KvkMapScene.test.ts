// The KvK map's scene (issue 817 part 2): the fit level shows ring counts and the other alliances' "TAG · n"
// without a member name; the city level draws only the houses in the visible box; Find picks a member and
// opens their sheet; the sheet's facts; the layer chips turn shields, kills bands and names on and off; a
// vertical one-finger swipe scrolls the page, a sideways one or a mouse or two-finger drag pans.
// Invented names, places and kills.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { kvkMapOf } from "@/lib/private/kvk-map";

import { sceneOf, sceneWordsOf } from "./kvk-map-scene-data";
import {
  alongAxis,
  axisOf,
  findOf,
  START,
  sceneStep,
  visibleOf,
  type SceneState,
} from "./kvk-map-view";
import { SceneView } from "./KvkMapScene";

const t = WORKSPACE_DICTIONARIES.en;
const AT0 = new Date("2026-11-21T09:45:00Z");
const map = kvkMapOf(
  {
    at: new Date("2026-11-21T14:00:00Z"),
    endAt: new Date("2026-11-21T16:00:00Z"),
    unplaced: 0,
    places: [
      { uid: 4, name: "Dawn", x: 431, y: 612, before: 50, after: 50 },
      { uid: 2, name: "Birch", x: 437, y: 618, before: 50, after: 61 },
      { uid: 3, name: "Cedar", x: 452, y: 640, before: 50, after: 97 },
      { uid: 1, name: "Alder", x: 470, y: 655, before: null, after: 70 },
    ],
  },
  { x: 440, y: 620 },
  [{ uid: 2, shielding: 1, shieldType: 0, mapAt: new Date("2026-11-21T09:40:00Z"), readAt: AT0 }],
  {
    roster: [{ uid: 2, power: 12_400_000, lastOnlineAt: new Date("2026-11-21T20:30:00Z") }],
    clusters: [{ tag: "RIV", members: 94, x: 600, y: 300 }],
  },
);
const ctx = { map, t, language: "en" as const, zone: "Etc/GMT+2" };
const data = sceneOf(ctx, "alpha");
const words = sceneWordsOf(map, t, "en");
const render = (state: SceneState) =>
  renderToStaticMarkup(createElement(SceneView, { data, words, state, dispatch: () => undefined }));
const step = (s: SceneState, ...actions: Parameters<typeof sceneStep>[2][]) =>
  actions.reduce((acc, a) => sceneStep(data, acc, a), s);
/** The plot's own markup: from its level to the axes line under it. */
const plotOf = (html: string) =>
  html.slice(html.indexOf("data-level="), html.indexOf("Map squares:"));

describe("the KvK map scene (issue 817)", () => {
  it("fits with ring counts round the castle and other alliances as TAG · n, with no name", () => {
    const plot = plotOf(render(START));
    expect(plot).toContain('data-level="fit"');
    expect(plot).toContain("Near · 1");
    expect(plot).toContain("Mid-way · 1");
    expect(plot).toContain("Far · 1");
    expect(plot).toContain("RIV · 94");
    for (const name of ["Alder", "Birch", "Cedar", "Dawn"]) expect(plot).not.toContain(name);
    expect(plot.match(/data-fit-dot/g)).toHaveLength(4);
  });

  it("zooms in to the city level and draws only the houses in the visible box", () => {
    const city = step(START, { type: "in" });
    expect(city.view.level).toBe("city");
    const plot = plotOf(render(city));
    expect([...plot.matchAll(/<g data-at="(\d)"/g)].map((m) => m[1])).toEqual(["0", "1", "2", "3"]);
    // A 20-square box round Birch holds Birch and Dawn only.
    const close = { ...city, view: { level: "city" as const, cx: 437, cy: 618, span: 20 } };
    expect(visibleOf(data.dots, close.view)).toEqual([1, 3]);
    expect([...plotOf(render(close)).matchAll(/<g data-at="(\d)"/g)].map((m) => m[1])).toEqual([
      "1",
      "3",
    ]);
    expect(step(close, { type: "out" }).view).toMatchObject({ span: 40 });
  });

  it("finds a member by part of the name and opens their sheet close up", () => {
    expect(findOf(data.dots, "ED")).toEqual([2]);
    expect(findOf(data.dots, " ")).toEqual([]);
    const found = step(START, { type: "find", i: 2 });
    expect(found.selected).toBe(2);
    expect(found.view).toMatchObject({ level: "city", cx: 452, cy: 640 });
    expect(render(found)).toMatch(/<dialog[^]*Cedar/);
  });

  it("lists a member's facts in the sheet with the link to their card", () => {
    const birch = data.dots[1];
    expect(birch?.facts).toEqual([
      ["Place", "X 437, Y 618"],
      ["Might", "12.4M"],
      ["KvK kills gained", "11"],
      ["Shield", "shield seen, as of Sat, Nov 21, 07:40 ST"],
      ["Distance to the castle point", "4 squares"],
      ["Last seen in game", "Sat, Nov 21, 18:30 ST"],
    ]);
    expect(data.dots[0]?.facts[2]).toEqual(["KvK kills gained", "not known"]);
    const html = render(step(START, { type: "in" }, { type: "pick", i: 1 }));
    expect(html).toContain('href="/w/alpha/members?m=2"');
    expect(html).toContain("Open the member card");
  });

  it("turns names, shields and kills bands on and off with the layer chips", () => {
    const city = step(START, { type: "in" });
    const before = render(city);
    expect(before).toMatch(
      /data-layer="names"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-layer="names"/,
    );
    expect(plotOf(before)).toContain(">Birch</bdi>");
    expect(plotOf(before)).toContain('fill-opacity="0.14"');
    const off = step(city, { type: "layer", key: "names" }, { type: "layer", key: "shields" });
    expect(off.layers).toMatchObject({ names: false, shields: false });
    expect(plotOf(render(off))).not.toContain(">Birch</bdi>");
    expect(plotOf(render(off))).not.toContain('fill-opacity="0.14"');
    // Kills bands: Cedar gained more than the median, a plum mark at the house's corner.
    expect(plotOf(before)).not.toContain("fill-plum");
    expect(plotOf(render(step(city, { type: "layer", key: "bands" })))).toContain("fill-plum");
  });

  it("leaves a vertical one-finger swipe to the page and pans a sideways one, a mouse or two fingers", () => {
    // The plot lets the browser scroll vertically on a phone at both levels.
    expect(render(START).match(/<div[^>]*data-level="fit"[^>]*>/)?.[0]).toContain("touch-pan-y");
    expect(
      render(step(START, { type: "in" })).match(/<div[^>]*data-level="city"[^>]*>/)?.[0],
    ).toContain("touch-pan-y");
    expect(axisOf("touch", 1, 3, 20)).toBeNull();
    expect(axisOf("touch", 1, 20, 3)).toBe("sideways");
    expect(alongAxis("sideways", 20, 3)).toEqual({ dx: 20, dy: 0 });
    expect(axisOf("touch", 2, 3, 20)).toBe("any");
    expect(axisOf("mouse", 1, 3, 20)).toBe("any");
    expect(alongAxis("any", 3, 20)).toEqual({ dx: 3, dy: 20 });
  });
});
