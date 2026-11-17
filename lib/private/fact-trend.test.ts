// Main squad and AD Tech over time (issue 347, D109): the card's change and date, and the week's progress.
import { describe, expect, it } from "vitest";

import type { FactRow } from "../repo/member-facts";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { lastTwo, progressOf, thanksWeek, weekBase } from "./fact-trend";
import { cardFormats, factLines, progressText } from "./member-card";

const ZONE = "Etc/GMT+2";
/** The game week of 2026-11-16 (a Monday): it starts at 2026-11-16T02:00Z in server time (UTC−2). */
const MONDAY = "2026-11-16";
const row = (uid: number, field: string, version: number, value: number, at: string): FactRow => ({
  uid,
  field,
  version,
  value,
  source: "message",
  writtenAt: new Date(at.includes("T") ? at : `${at}T12:00:00Z`),
});
const NOW = new Date("2026-11-17T12:00:00Z");
const fact = (value: number, version: number) => ({
  value,
  source: "message" as const,
  version,
  at: "2026-11-17T12:00:00Z",
});

describe("the card's trend (D109)", () => {
  it("puts the change since the version before on its own line, with a short date", () => {
    const facts = { squadMight: fact(10_200_000, 2), adTech: fact(74, 2) };
    const previous = {
      squadMight: { value: 9_800_000, at: new Date("2026-11-10T12:00:00Z") },
      adTech: { value: 69, at: new Date("2026-11-10T12:00:00Z") },
    };
    const en = factLines(facts, WORKSPACE_DICTIONARIES.en, cardFormats("en", ZONE, NOW), previous);
    expect(en.find((l) => l.field === "squadMight")).toMatchObject({
      value: "10.2M",
      change: "+400K since Nov 10",
      updated: "Updated Nov 17",
    });
    expect(en.find((l) => l.field === "adTech")).toMatchObject({
      value: "74%",
      change: "+5 points since Nov 10",
    });
    // PT: the date never wraps inside itself (a no-break space).
    const t = WORKSPACE_DICTIONARIES["pt-BR"];
    const pt = factLines(facts, t, cardFormats("pt-BR", ZONE, NOW), previous);
    expect(pt.find((l) => l.field === "squadMight")?.change).toBe("+400K desde 10 nov.");
  });

  it("marks AD Tech at 100% complete, and says nothing of a change with no version before", () => {
    const facts = { squadMight: fact(8_000_000, 1), adTech: fact(100, 1) };
    const t = WORKSPACE_DICTIONARIES.en;
    const lines = factLines(facts, t, cardFormats("en", ZONE, NOW), {
      squadMight: null,
      adTech: null,
    });
    expect(lines.find((l) => l.field === "adTech")?.change).toBe("Complete");
    expect(lines.find((l) => l.field === "squadMight")?.change).toBeUndefined();
  });
});

describe("the week's progress in the thanks (D109, weekly baseline D114)", () => {
  it("names AD Tech reaching 100% and main squad up 5% or more over the value before the week", () => {
    const history = [
      // Bo: AD Tech 90 → 100 at the very first hour of the week (Mon 00:00 server time).
      row(2, "adTech", 1, 90, "2026-11-12"),
      row(2, "adTech", 2, 100, "2026-11-16T02:00:00Z"),
      // Ana: main squad 10M → 10.5M this week, exactly +5%.
      row(1, "squadMight", 1, 10_000_000, "2026-11-12"),
      row(1, "squadMight", 2, 10_500_000, "2026-11-17"),
      // Cy: +2% only, and AD Tech first recorded at 100 (nothing to compare with).
      row(3, "squadMight", 1, 10_000_000, "2026-11-12"),
      row(3, "squadMight", 2, 10_200_000, "2026-11-17"),
      row(3, "adTech", 1, 100, "2026-11-17"),
      // Di: AD Tech reached 100 one hour before the week began (Sun 23:00 server time).
      row(4, "adTech", 1, 80, "2026-11-05"),
      row(4, "adTech", 2, 100, "2026-11-16T01:00:00Z"),
      // Ed: two saves this week, 10.0M → 10.3M → 10.6M: +6% against the week start, though each step
      // is only about +3%.
      row(5, "squadMight", 1, 10_000_000, "2026-11-12"),
      row(5, "squadMight", 2, 10_300_000, "2026-11-16"),
      row(5, "squadMight", 3, 10_600_000, "2026-11-17"),
      // Fy: a first-ever value this week, then +10%: nothing from before the week to compare with.
      row(6, "squadMight", 1, 10_000_000, "2026-11-16"),
      row(6, "squadMight", 2, 11_000_000, "2026-11-17"),
    ];
    const members = ["Bo", "Ana", "Cy", "Di", "Ed", "Fy"].map((name, i) => ({
      uid: [2, 1, 3, 4, 5, 6][i] as number,
      name,
    }));
    const progress = progressOf(history, members, MONDAY, ZONE);
    expect(progress.map((p) => p.name)).toEqual(["Ana", "Bo", "Ed"]);
    expect(progress.find((p) => p.name === "Ed")?.squadGrowth).toBeCloseTo(0.06);
    const t = WORKSPACE_DICTIONARIES.en;
    expect(progress.map((p) => progressText(p, t))).toEqual([
      "grew their main squad",
      "finished AD Tech",
      "grew their main squad",
    ]);
  });

  it("covers last week on a Monday, without the Monday's own saves, and this week otherwise", () => {
    expect(thanksWeek("2026-11-22")).toBe("2026-11-16"); // Sunday: this week
    expect(thanksWeek("2026-11-23")).toBe("2026-11-16"); // Monday: last week
    expect(thanksWeek("2026-11-24")).toBe("2026-11-23"); // Tuesday: this week
    const history = [
      row(1, "squadMight", 1, 10_000_000, "2026-11-12"),
      row(1, "squadMight", 2, 10_600_000, "2026-11-20"),
      // Saved on Monday 23rd (server time): next week's, not read for the week of the 16th.
      row(1, "squadMight", 3, 9_000_000, "2026-11-23T12:00:00Z"),
    ];
    const ana = [{ uid: 1, name: "Ana" }];
    expect(progressOf(history, ana, thanksWeek("2026-11-23"), ZONE).map((p) => p.name)).toEqual([
      "Ana",
    ]);
  });

  it("puts the same comparison on the card: the change this week, else since the version before", () => {
    const history = [
      row(5, "squadMight", 1, 10_000_000, "2026-11-12"),
      row(5, "squadMight", 2, 10_300_000, "2026-11-16"),
      row(5, "squadMight", 3, 10_600_000, "2026-11-17"),
    ];
    const week = { squadMight: weekBase(history, 5, "squadMight", MONDAY, ZONE) };
    const previous = { squadMight: lastTwo(history, 5, "squadMight")?.before ?? null };
    const facts = { squadMight: fact(10_600_000, 3) };
    const t = WORKSPACE_DICTIONARIES.en;
    const f = cardFormats("en", ZONE, NOW);
    expect(factLines(facts, t, f, previous, week)[0]?.change).toBe("+600K this week");
    // A week later with no new version: back to "since" the version before.
    const next = { squadMight: weekBase(history, 5, "squadMight", "2026-11-23", ZONE) };
    expect(next.squadMight).toBeNull();
    expect(factLines(facts, t, f, previous, next)[0]?.change).toBe("+300K since Nov 16");
  });
});
