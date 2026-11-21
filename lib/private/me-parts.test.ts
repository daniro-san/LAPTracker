import { describe, expect, it } from "vitest";

import type { OwnDay } from "../repo/me";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { nameMatches } from "./me-link";
import { neededLines, recoveryLine, seriesOf } from "./me-parts";

const t = WORKSPACE_DICTIONARIES.en;
const f = {
  compact: (n: number) => `${n}`,
  number: (n: number) => `${n}`,
  date: (day: string) => day,
  weekday: (day: string) => day.slice(8),
  dayOfMonth: (day: string) => String(Number(day.slice(8))),
};

const day = (d: string, _: unknown, power: number | null = 1000, listed = true): OwnDay => ({
  day: d,
  listed,
  name: listed ? "Ana Invented" : null,
  power,
  kills: 5,
});

describe("a member's own progress (D142)", () => {
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

  it("lists their team, seat and marks, the soonest first", () => {
    const lines = neededLines(
      {
        team: "B",
        seats: [{ movedTo: null, planned: "2026-10-29", coach: true, second: null }],
        marks: [{ kind: "shield", variant: null, day: "2026-11-02", part: "wall", mark: "yes" }],
      },
      "2026-11-02",
      t,
      (d) => d,
    );
    expect(lines).toEqual([
      "Elixir Scramble this week: Team B",
      "Raid prep, 2026-11-02: Squads off the wall",
      "Alliance Caravan, 2026-11-05: you are the Coachman.",
    ]);
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
