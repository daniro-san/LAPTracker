// Main squad and AD Tech over time (issue 347, D109): the card's change and date, and the week's progress.
import { describe, expect, it } from "vitest";

import type { FactRow } from "../repo/member-facts";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { progressOf } from "./fact-trend";
import { cardFormats, factLines, progressText } from "./member-card";

const ZONE = "Etc/GMT+2";
/** The game week of 2026-11-16 (a Monday). */
const MONDAY = "2026-11-16";
const row = (uid: number, field: string, version: number, value: number, at: string): FactRow => ({
  uid,
  field,
  version,
  value,
  source: "message",
  writtenAt: new Date(`${at}T12:00:00Z`),
});
const t = WORKSPACE_DICTIONARIES.en;
const f = cardFormats("en", ZONE, new Date("2026-11-17T12:00:00Z"));

describe("the card's trend (D109)", () => {
  it("shows the value, the day it was saved and the change since the version before", () => {
    const facts = {
      squadMight: {
        value: 10_200_000,
        source: "message" as const,
        version: 2,
        at: "2026-11-17T12:00:00Z",
      },
      adTech: { value: 74, source: "message" as const, version: 2, at: "2026-11-17T12:00:00Z" },
    };
    const previous = {
      squadMight: { value: 9_800_000, at: new Date("2026-11-10T12:00:00Z") },
      adTech: { value: 69, at: new Date("2026-11-10T12:00:00Z") },
    };
    const lines = factLines(facts, t, f, previous);
    expect(lines.find((l) => l.field === "squadMight")).toMatchObject({
      value: "10.2M",
      change: "+400K since Tue, Nov 10",
      updated: "Updated Tue, Nov 17",
    });
    expect(lines.find((l) => l.field === "adTech")).toMatchObject({
      value: "74%",
      change: "was 69%",
    });
  });

  it("marks AD Tech at 100% complete, and says nothing of a change with no version before", () => {
    const facts = {
      squadMight: {
        value: 8_000_000,
        source: "officer" as const,
        version: 1,
        at: "2026-11-17T12:00:00Z",
      },
      adTech: { value: 100, source: "officer" as const, version: 1, at: "2026-11-17T12:00:00Z" },
    };
    const lines = factLines(facts, t, f, { squadMight: null, adTech: null });
    expect(lines.find((l) => l.field === "adTech")?.change).toBe("complete");
    expect(lines.find((l) => l.field === "squadMight")?.change).toBeUndefined();
  });
});

describe("the week's progress in the thanks (D109)", () => {
  it("names AD Tech reaching 100% and main squad up 5% or more this week, by name, nothing without a before", () => {
    const history = [
      // Bo: AD Tech 90 → 100 this week.
      row(2, "adTech", 1, 90, "2026-11-12"),
      row(2, "adTech", 2, 100, "2026-11-17"),
      // Ana: main squad 10M before the week → 10.6M this week (+6%).
      row(1, "squadMight", 1, 10_000_000, "2026-11-12"),
      row(1, "squadMight", 2, 10_600_000, "2026-11-17"),
      // Cy: +2% only, and AD Tech first recorded at 100 (nothing to compare with).
      row(3, "squadMight", 1, 10_000_000, "2026-11-12"),
      row(3, "squadMight", 2, 10_200_000, "2026-11-17"),
      row(3, "adTech", 1, 100, "2026-11-17"),
      // Di: AD Tech reached 100 last week.
      row(4, "adTech", 1, 80, "2026-11-05"),
      row(4, "adTech", 2, 100, "2026-11-12"),
    ];
    const members = [
      { uid: 2, name: "Bo" },
      { uid: 1, name: "Ana" },
      { uid: 3, name: "Cy" },
      { uid: 4, name: "Di" },
    ];
    const progress = progressOf(history, members, MONDAY, ZONE);
    expect(progress.map((p) => p.name)).toEqual(["Ana", "Bo"]);
    expect(progress.map((p) => progressText(p, t, "en"))).toEqual([
      "main squad +6%",
      "AD Tech 100%",
    ]);
  });
});
