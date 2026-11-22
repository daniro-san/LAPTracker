// The member card's "Last 7 days" (issue 461, D136): the 7 server days up to the newest read, "—" for a
// day with no read, "none" for a read that sent nothing (D127), averages with "none" as 0 (#663), coins
// against their 1,000 cap, and might since the first day. Invented values.
import { describe, expect, it } from "vitest";

import type { RosterMember, RosterRead } from "../repo/workspace-rosters";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { cardFormats } from "./member-card";
import { daysCard, lastDays, type DaysFormats } from "./member-days";

const member = (uid: number, fields: Partial<RosterMember> = {}): RosterMember => ({
  uid,
  name: `P${uid}`,
  power: 1000,
  kills: null,
  lv: 25,
  rankCode: 103,
  rankLabel: "R3",
  dailyTech: null,
  dailyHonor: null,
  active: null,
  joinedAt: null,
  lastOnlineAt: null,
  x: 0,
  y: 0,
  ...fields,
});
const read = (day: string, members: RosterMember[]): RosterRead => ({
  day,
  at: new Date(`${day}T01:37:00Z`),
  members,
});

const t = WORKSPACE_DICTIONARIES.en;
const card = cardFormats("en", "Etc/GMT+2", new Date("2026-11-20T12:00:00Z"));
const f: DaysFormats = {
  compact: card.compact,
  number: card.number,
  date: (day) => card.date(day),
  weekday: (day) => day,
  dayOfMonth: (day) => day.slice(8),
};

// Nov 13–19: no read on the 15th, the 16th does not list member 1, the 17th lists them with nothing sent.
const READS = [
  read("2026-11-12", [member(1, { active: 999, power: 1 })]),
  read("2026-11-13", [
    member(1, { active: 500, dailyHonor: 1000, dailyTech: 6500, power: 10_000_000 }),
  ]),
  read("2026-11-14", [
    member(1, { active: 700, dailyHonor: 500, dailyTech: 12_400, power: 10_500_000 }),
  ]),
  read("2026-11-16", [member(2)]),
  read("2026-11-17", [member(1, { power: null })]),
  read("2026-11-18", [member(1, { active: 600, dailyHonor: 1000, power: 11_200_000 })]),
  read("2026-11-19", [member(1, { active: 400, dailyTech: 3100, power: 11_200_000 })]),
];

describe("the member card's last 7 days (issue 461)", () => {
  it("reads the 7 days up to the newest read: numbers, none on a read that sent nothing, no data otherwise", () => {
    const d = lastDays(READS, 1);
    expect(d?.days).toEqual([
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
    ]);
    expect(d?.rows.quests).toEqual([500, 700, null, null, "none", 600, 400]);
    expect(d?.rows.coins).toEqual([1000, 500, null, null, "none", 1000, "none"]);
    // Might on the newest day with one against the oldest in the 7 days (the 12th is outside them).
    expect(d?.might).toEqual({ from: "2026-11-13", change: 1_200_000 });
    expect(lastDays([], 1)).toBeNull();
  });

  it("says each row's average with its none days counted as 0 and named, draws coins against 1,000 and never a 0 for no data", () => {
    const words = daysCard(lastDays(READS, 1) as NonNullable<ReturnType<typeof lastDays>>, t, f);
    const [quests, coins, donations] = words.rows;
    // Owner, 2026-11-22 (#663): (500 + 700 + 0 + 600 + 400) / 5; the two days with no read never count.
    expect(quests?.average).toBe("Average 440 · 5 days, of which 1 none");
    expect(coins?.average).toBe("Average 500 · 5 days, of which 2 none");
    expect(quests?.bars.map((b) => b.value)).toEqual([
      "500",
      "700",
      "—",
      "—",
      "none",
      "600",
      "400",
    ]);
    expect(quests?.bars[2]?.said).toBe("Sun, Nov 15: no data");
    expect(quests?.bars[1]?.share).toBe(1);
    expect(coins?.bars.map((b) => b.share)).toEqual([1, 0.5, null, null, null, 1, null]);
    expect(donations?.average).toBe("Average 4.40K · 5 days, of which 2 none");
    expect(donations?.bars[1]?.value).toBe("12.4K");
    expect(words.might).toBe("Might +1.20M since Fri, Nov 13");
  });

  it("says a week of only none days as none on all of them, never Average 0", () => {
    const week = ["13", "14", "15", "16", "17", "18", "19"].map((d) =>
      read(`2026-11-${d}`, [member(1)]),
    );
    const [quests] = daysCard(
      lastDays(week, 1) as NonNullable<ReturnType<typeof lastDays>>,
      t,
      f,
    ).rows;
    expect(quests?.average).toBe("None on all 7 days");
    expect(quests?.bars.every((b) => b.value === "none")).toBe(true);
  });
});
