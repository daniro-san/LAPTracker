import { describe, expect, it } from "vitest";

import type { OwnDay } from "../repo/me";
import { zonedInstant } from "./calendar-time";
import { endOf } from "./calendar-words";
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
      Date.parse("2026-11-01T14:00:00Z"), // Sun 12:00 ST
    );
    expect(lines).toEqual([
      { line: "Elixir Scramble this week: Team B", when: null },
      { line: "Raid prep, 2026-11-02 · your mark: “Squads off the wall”", when: { at: 1, end: 2 } },
      { line: "Alliance Caravan, 2026-11-05: you are the Coachman.", when: { at: 1, end: 2 } },
    ]);
    expect(asked).toEqual(["caravan 2026-11-05 840", "shield 2026-11-02 null"]);
  });

  // KvK Saturday 2026-11-21: the raid at the reset (00:00 ST), KvK at 12:00 ST, its End read at 16:15 ST.
  const SERVER = "Etc/GMT+2";
  const noMarks = (now: number) =>
    neededLines(
      {
        team: null,
        seats: [],
        marks: (["main", "wall"] as const).map((part) => ({
          kind: "shield",
          variant: null,
          day: "2026-11-21",
          minute: 12 * 60,
          part,
          mark: "no",
        })),
      },
      "2026-11-16",
      t,
      (d) => d,
      (kind, day, minute) => {
        const end = endOf(kind, day, minute, SERVER, "16:15");
        return { at: minute === null ? end : zonedInstant(day, minute, SERVER), end };
      },
      now,
    );

  it("tells a member marked ✗ on Raid prep what to do next, before the reset and then before KvK (D137)", () => {
    const friday = noMarks(Date.parse("2026-11-20T02:00:00Z")); // Fri 00:00 ST, the raid's eve
    expect(friday).toEqual(noMarks(Date.parse("2026-11-21T01:00:00Z"))); // Fri 23:00 ST
    expect(friday.map((l) => [l.line, l.step])).toEqual([
      [
        "Raid prep, 2026-11-21 · your mark: “No shield”",
        "Next step: turn on your shield before the reset (00:00 ST).",
      ],
      [
        "Raid prep, 2026-11-21 · your mark: “On the wall”",
        "Next step: take your squads off the wall before the reset (00:00 ST).",
      ],
    ]);
    const morning = noMarks(Date.parse("2026-11-21T12:30:00Z")); // Sat 10:30 ST
    expect(morning.map((l) => l.step)).toEqual([
      "Next step: turn on your shield before KvK starts at 12:00 ST.",
      "Next step: take your squads off the wall before KvK starts at 12:00 ST.",
    ]);
  });

  it("keeps only the neutral record of a Raid prep ✗ before the raid's eve and once KvK has started", () => {
    for (const now of [
      Date.parse("2026-11-20T01:00:00Z"), // Thu 23:00 ST: "the reset" would not be tonight's
      Date.parse("2026-11-21T17:00:00Z"), // Sat 15:00 ST
      Date.parse("2026-11-21T19:00:00Z"), // Sat 17:00 ST
    ]) {
      const lines = noMarks(now);
      expect(lines.map((l) => l.line)).toEqual([
        "Raid prep, 2026-11-21 · your mark: “No shield”",
        "Raid prep, 2026-11-21 · your mark: “On the wall”",
      ]);
      expect(lines.map((l) => l.step)).toEqual([undefined, undefined]);
    }
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
