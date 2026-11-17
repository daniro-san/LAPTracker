import { describe, expect, it } from "vitest";

import { checkKnown, duelKnown, factKnown, grouped, groupedValue } from "./draft-known";

const w = {
  "shots.was": "saved before: {v}",
  "shots.duel.daysMore": "days add up to {sum}",
  "shots.duel.overWeek": "more than the week's {v}",
  "shots.oursNone": "no game data",
  "shots.ours": "Game data: {v}",
  "shots.same": "same",
  "shots.higher": "picture is {d} higher",
  "shots.lower": "picture is {d} lower",
  "shots.field.adTech": "AD Tech",
  "shots.adComplete": "AD Tech is already 100%",
  "shots.factNew": "{field}: {now} (nothing before)",
  "shots.factChange": "{field}: {was} → {now}",
};

describe("what a draft row shows beside its value (issue 299)", () => {
  it("groups digits with the language's separator", () => {
    expect(grouped(22961474, ".")).toBe("22.961.474");
  });

  it("shows a value field's digits grouped under it, and nothing for an empty field", () => {
    expect(groupedValue("77384266", ",")).toBe("77,384,266");
    expect(groupedValue("950", ",")).toBe("950");
    expect(groupedValue("", ",")).toBe("");
  });

  it("Alliance Duel: the value saved before, days above the week, a day above the week", () => {
    expect(duelKnown({ week: 900 }, "week", 1000, w, ",")).toEqual(["saved before: 900"]);
    expect(duelKnown({ mon: 600, tue: 500 }, "week", 1000, w, ",")).toEqual([
      "days add up to 1,100",
    ]);
    expect(duelKnown({ week: 800 }, "mon", 1000, w, ",")).toEqual(["more than the week's 800"]);
  });

  it("checks: no game data, the same, or how far the picture is above or below", () => {
    expect(checkKnown(null, 4000, w, ",")).toEqual(["no game data"]);
    expect(checkKnown(5750, 5750, w, ",")).toEqual(["Game data: 5,750", "same"]);
    expect(checkKnown(1750, 5750, w, ",")).toEqual(["Game data: 1,750", "picture is 4,000 higher"]);
    expect(checkKnown(5750, 1750, w, ",")).toEqual(["Game data: 5,750", "picture is 4,000 lower"]);
  });

  it("member facts: complete at 100%, nothing before, previous → new", () => {
    expect(factKnown("adTech", 100, 55, w, ",")).toEqual(["AD Tech is already 100%"]);
    expect(factKnown("adTech", undefined, 55, w, ",")).toEqual(["AD Tech: 55% (nothing before)"]);
    expect(factKnown("adTech", 50, 55, w, ",")).toEqual(["AD Tech: 50% → 55%"]);
  });
});
