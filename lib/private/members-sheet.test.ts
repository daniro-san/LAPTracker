import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "./dictionary";
import type { MemberRow } from "./members";
import { reasonText, sheetHeader, sheetRow, type Formats } from "./members-sheet";

const t = WORKSPACE_DICTIONARIES.en;
const f: Formats = { date: (at) => String(at), number: String, language: "en", zone: "Etc/GMT+2" };
const week = [
  "2026-11-09",
  "2026-11-10",
  "2026-11-11",
  "2026-11-12",
  "2026-11-13",
  "2026-11-14",
  "2026-11-15",
];

const m: MemberRow = {
  uid: 7,
  name: "=Marigold",
  rank: "R4 · Goddess",
  rankCode: 104,
  might: 61_234_567,
  kills: null,
  sanctuary: 29,
  activity: 214,
  honor: 300,
  donations: [5150, null, 4000, "later", "later", "later", "later"],
  weekTotal: 9150,
  joinedAt: null,
  lastOnlineAt: new Date("2026-11-15T20:00:00Z"),
  mapX: 4321,
  mapY: 8765,
  duel: {},
  seenSince: "2026-11-02",
  isNew: false,
  reasons: [{ kind: "might", days: 9 }],
  missing: ["donations"],
  missingDays: 1,
  facts: {},
  officerStatus: null,
  awayUntil: null,
  early: false,
};

describe("Copy for spreadsheet (D71)", () => {
  it("copies the member's columns and leaves out the map position, online time and photo", () => {
    const header = sheetHeader(week, t).split("\t");
    const row = sheetRow(m, t, f).split("\t");

    expect(header).toEqual([
      "Name",
      "Rank",
      "Might",
      "Sanctuary",
      "Mon 9",
      "Tue 10",
      "Wed 11",
      "Thu 12",
      "Fri 13",
      "Sat 14",
      "Sun 15",
      "Week total",
      "Activity this week",
      "Day’s honor",
      "Joined",
      "Seen since",
      "Status",
    ]);
    expect(row).toEqual([
      "'=Marigold",
      "R4 · Goddess",
      "61234567",
      "29",
      "5150",
      "",
      "4000",
      "",
      "",
      "",
      "",
      "9150",
      "214",
      "300",
      "",
      "2026-11-02",
      "Check in: might unchanged for 9 days",
    ]);
    expect(row.join("\t")).not.toMatch(/4321|8765|2026-11-15/);
  });

  it("writes the Joined day in server time, as the card does", () => {
    // 01:30 UTC on the 10th is 23:30 on the 9th at the server (UTC−2).
    const joined = { ...m, joinedAt: new Date("2026-11-10T01:30:00Z") };

    expect(sheetRow(joined, t, f).split("\t")[14]).toBe("2026-11-09");
  });
});

describe("Check in reasons (D75)", () => {
  it("says the offline proxy's evidence: no new donations or activity, and for how many days", () => {
    const idle = { kind: "idle", days: 2, activity: 87, donated: 0 } as const;

    expect(reasonText(idle, t, f)).toBe("no new donations or activity for 2 days");
  });
});
