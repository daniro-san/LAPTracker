// The member card's "Last 7 days" (issue 461, D136): the 7 server days up to the newest read, "—" for a
// day with no read, "none" for a read that sent nothing (D127), averages with "none" as 0 (#663), coins
// against their 1,000 cap, quest points from the week's running total against the daily cap (#739), and
// might since the first day. Invented values.
import { describe, expect, it } from "vitest";

import type { RosterMember, RosterRead } from "../repo/workspace-rosters";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { cardFormats } from "./member-card";
import { allianceBest, daysCard, lastDays, type DaysFormats } from "./member-days";

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
  language: "en",
};

// Nov 13–19: no read on the 15th, the 16th (a Monday) does not list member 1, the 17th lists them with no
// coins or donations sent. `active` is the running total since Monday's reset: the 17th's quest points are
// no data (no read of the 16th lists them), the 18th's are none (the total did not move).
const READS = [
  read("2026-11-12", [member(1, { active: 800, power: 1 })]),
  read("2026-11-13", [
    member(1, { active: 1040, dailyHonor: 1000, dailyTech: 6500, power: 10_000_000 }),
  ]),
  read("2026-11-14", [
    member(1, { active: 1200, dailyHonor: 500, dailyTech: 12_400, power: 10_500_000 }),
  ]),
  read("2026-11-16", [member(2)]),
  read("2026-11-17", [member(1, { active: 230, power: null })]),
  read("2026-11-18", [member(1, { active: 230, dailyHonor: 1000, power: 11_200_000 })]),
  read("2026-11-19", [member(1, { active: 430, dailyTech: 3100, power: 11_200_000 })]),
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
    expect(d?.rows.quests).toEqual([240, 160, null, null, null, "none", 200]);
    expect(d?.rows.coins).toEqual([1000, 500, null, null, "none", 1000, "none"]);
    // Might on the newest day with one against the oldest in the 7 days (the 12th is outside them).
    expect(d?.might).toEqual({ from: "2026-11-13", change: 1_200_000 });
    expect(lastDays([], 1)).toBeNull();
  });

  it("says each row's average with its none days counted as 0 and named, draws coins against 1,000 and never a 0 for no data", () => {
    const words = daysCard(lastDays(READS, 1) as NonNullable<ReturnType<typeof lastDays>>, t, f);
    const [quests, coins, donations] = words.rows;
    // Owner, 2026-11-22 (#663): (240 + 160 + 0 + 200) / 4; the three days with no data never count.
    expect(quests?.average).toBe("Average 150 · 4 days, of which 1 none");
    expect(coins?.average).toBe("Average 500 · 5 days, of which 2 none");
    expect(quests?.bars.map((b) => b.value)).toEqual(["240", "160", "—", "—", "—", "none", "200"]);
    expect(quests?.bars[2]?.said).toBe("Sun, Nov 15: no data");
    // Against the daily cap, 240 (#739): a full day fills the bar.
    expect(quests?.bars.map((b) => b.share)).toEqual([
      1,
      160 / 240,
      null,
      null,
      null,
      null,
      200 / 240,
    ]);
    expect(coins?.bars.map((b) => b.share)).toEqual([1, 0.5, null, null, null, 1, null]);
    expect(donations?.average).toBe("Average 4.40K · 5 days, of which 2 none");
    expect(donations?.bars[1]?.value).toBe("12.4K");
    expect(words.might).toBe("Might +1.20M since Fri, Nov 13");
  });

  it("draws quest points against the daily cap and donations against the alliance's best member-day, so a steady low giver and a steady high giver differ (D158, #739)", () => {
    // Member 1 earns 120 quest points and sends 2,000 a day, member 2 earns 180 and sends 8,000, every day
    // from Thursday 12: `active` adds the days up from Monday 16's reset (Monday is day 1 of the week).
    const week = ["12", "13", "14", "15", "16", "17", "18", "19"].map((d) => {
      const days = ((new Date(`2026-11-${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
      return read(`2026-11-${d}`, [
        member(1, { active: 120 * days, dailyTech: 2000, dailyHonor: 1000 }),
        member(2, { active: 180 * days, dailyTech: 8000, dailyHonor: 1000 }),
      ]);
    });
    // As the member card reads them: the member's days with the alliance's best member-day.
    const card = (uid: number) => {
      const d = lastDays(week, uid) as NonNullable<ReturnType<typeof lastDays>>;
      return daysCard({ ...d, best: allianceBest(week, d.days) }, t, f);
    };
    const [quests, coins, donations] = card(1).rows;
    expect(quests?.bars.map((b) => b.share)).toEqual(Array(7).fill(0.5));
    expect(donations?.bars.map((b) => b.share)).toEqual(Array(7).fill(0.25));
    expect(coins?.bars.map((b) => b.share)).toEqual(Array(7).fill(1));
    expect(card(2).rows[0]?.bars.map((b) => b.share)).toEqual(Array(7).fill(0.75));
    expect(card(1).scale).toBe(
      "Bars: coins out of 1,000 and quest points out of 240, the most a day; donations against 8.00K, the alliance's best day by one member in these 7 days.",
    );
  });

  it("says a week of only none days as none on all of them, never Average 0", () => {
    const week = ["12", "13", "14", "15", "16", "17", "18", "19"].map((d) =>
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
