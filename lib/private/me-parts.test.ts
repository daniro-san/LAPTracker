import { describe, expect, it } from "vitest";

import type { OwnDay } from "../repo/me";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { nameMatches } from "./me-link";
import { neededLines, recoveryLine, seriesOf, weekCard } from "./me-parts";

const t = WORKSPACE_DICTIONARIES.en;
const f = {
  compact: (n: number) => `${n}`,
  number: (n: number) => `${n}`,
  date: (day: string) => day,
  weekday: (day: string) => day.slice(8),
  dayOfMonth: (day: string) => String(Number(day.slice(8))),
};

const day = (d: string, active: unknown, power: number | null = 1000, listed = true): OwnDay => ({
  day: d,
  listed,
  name: listed ? "Ana Invented" : null,
  power,
  kills: 5,
  daily: listed ? { active, daily_honor: active, daily_tech: active } : null,
});

describe("a member's own week (D142)", () => {
  it("says none, no data and not read yet apart, and puts their own last week beside it", () => {
    // Today is Thursday 2026-11-05; the newest read is Wednesday's.
    const days = [
      day("2026-10-27", 300),
      day("2026-10-28", 500),
      day("2026-11-02", 600),
      day("2026-11-03", null),
      day("2026-11-04", 400),
    ];
    const card = weekCard(days, "2026-11-05", t, f);
    const quests = card?.rows.find((r) => r.metric === "quests");
    expect(quests?.bars.map((b) => b.value)).toEqual(["600", "none", "400", "", "", "", ""]);
    expect(quests?.bars[3]?.said).toBe("2026-11-05: not read yet");
    // The average counts the days with a number only (D75).
    expect(quests?.average).toBe("This week: Average 500 · 2 days");
    expect(quests?.last).toBe("Last week: Average 400 · 2 days");
    expect(weekCard([], "2026-11-05", t, f)).toBeNull();
    // No number yet this week: no average, and last week stays a plain line, never a target.
    const early = weekCard([day("2026-10-28", 500), day("2026-11-02", null)], "2026-11-02", t, f);
    expect(early?.rows[0]).toMatchObject({
      average: "This week: no average yet",
      last: "Last week: Average 500 · 1 day",
    });
    expect(weekCard([day("2026-11-02", 500)], "2026-11-02", t, f)?.rows[0]?.last).toBe(
      "Last week: no average",
    );
  });

  it("draws might over 30 days, and the recovery since KvK against their own might before it", () => {
    const days = [day("2026-10-01", 1, 500), day("2026-11-02", 1, 900), day("2026-11-04", 1, 920)];
    // The read of 2026-10-01 is outside the 30 days.
    expect(seriesOf(days, "power", t, f)).toMatchObject({
      line: "Might 920 · +20 since 2026-11-02",
      points: [{ day: "2026-11-02" }, { day: "2026-11-04" }],
    });
    expect(recoveryLine(days, { day: "2026-10-31", power: 1000 }, t, f.date)).toBe(
      "Back to 92% of your might before KvK (2026-10-31).",
    );
    // A KvK after the newest read says nothing yet.
    expect(recoveryLine(days, { day: "2026-11-04", power: 1000 }, t, f.date)).toBeNull();
  });

  it("lists their team, seat and marks, the soonest first, each mark as a record with its times", () => {
    const asked: string[] = [];
    const lines = neededLines(
      {
        team: "B",
        seats: [{ movedTo: null, planned: "2026-10-29", minute: 840, coach: true, second: null }],
        marks: [
          {
            kind: "shield",
            variant: null,
            day: "2026-11-02",
            minute: null,
            part: "wall",
            mark: "yes",
          },
        ],
      },
      "2026-11-02",
      t,
      (d) => d,
      (kind, day, minute) => {
        asked.push(`${kind} ${day} ${minute}`);
        return { at: 1, end: 2 };
      },
    );
    expect(lines).toEqual([
      { line: "Elixir Scramble this week: Team B", when: null },
      { line: "Raid prep, 2026-11-02 · your mark: “Squads off the wall”", when: { at: 1, end: 2 } },
      { line: "Alliance Caravan, 2026-11-05: you are the Coachman.", when: { at: 1, end: 2 } },
    ]);
    expect(asked).toEqual(["caravan 2026-11-05 840", "shield 2026-11-02 null"]);
  });
});

describe("the officer's name hint (D142)", () => {
  const roster = [
    { uid: 1, name: "Wren", rank: null, might: null },
    { uid: 2, name: "Wren•Thorne", rank: null, might: null },
    { uid: 3, name: "Fennel•Thorne", rank: null, might: null },
  ];
  it("says the name matches only on the matcher's one match by current name", () => {
    expect(nameMatches("wren", 1, roster)).toBe(true);
    expect(nameMatches("Wren", 2, roster)).toBe(false);
    // A part of a joined name (D74's segment match) is no match.
    expect(nameMatches("Fennel", 3, roster)).toBe(false);
    expect(nameMatches(null, 1, roster)).toBe(false);
  });
});
