import { describe, expect, it } from "vitest";

import type { DraftView } from "@/lib/private/import-view";

import {
  checkKnown,
  checkSummary,
  duelKnown,
  factKnown,
  grouped,
  groupedValue,
} from "./draft-known";

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

describe("checkSummary (panel PD-5)", () => {
  type Row = DraftView["rows"][number];
  const row = (match: Row["match"], value: number | null) =>
    ({ rank: 1, name: "x", value, flags: [], match, suggestions: [] }) as Row;
  const sure = (uid: number, value: number | null) => row({ status: "sure", uid }, value);

  it("sends each sure member once and compares only members with our value", () => {
    const view = {
      rows: [
        sure(1, 100), // same as ours
        sure(2, 250), // differs from ours (200)
        sure(1, 999), // the same member again: left out
        sure(3, 50), // ours is null: sent, not compared (D75)
        sure(4, null), // no value read: left out
        row({ status: "doubtful", uids: [5, 6] }, 70), // not sure: left out
      ],
      ours: { 1: 100, 2: 200, 3: null },
    };
    const sum = checkSummary(view);
    expect(sum.sent).toEqual([
      { uid: 1, value: 100 },
      { uid: 2, value: 250 },
      { uid: 3, value: 50 },
    ]);
    expect(sum).toMatchObject({ compared: 2, same: 1, left: 4 });
  });

  it("compares nothing when our values are missing", () => {
    expect(checkSummary({ rows: [sure(1, 100)], ours: null })).toMatchObject({
      compared: 0,
      same: 0,
      left: 1,
    });
  });
});
