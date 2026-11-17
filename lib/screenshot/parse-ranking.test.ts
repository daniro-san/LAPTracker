import { describe, expect, it } from "vitest";

import { parseRanking } from "./parse-ranking";
import { recorded } from "./test-helpers";

describe("parseRanking", () => {
  it("reads rank, name and value of each row", () => {
    const rows = parseRanking(recorded("23-donation-weekly"));
    expect(rows.map((r) => [r.rank, r.value])).toEqual([
      [87, 25350],
      [88, 24950],
      [89, 24050],
      [90, 22600],
      [91, 21700],
      [92, 21150],
      [93, 19400],
    ]);
    expect(rows.map((r) => r.name)).toContain("Kacper6741");
  });

  it("reads the R-badge shown above a row", () => {
    const rows = parseRanking(recorded("24-donation-weekly"));
    expect(rows.map((r) => r.rankBadge)).toEqual([null, 2, null, 3, 3, 3, 2]);
  });

  it("leaves the badge empty when its text was misread", () => {
    const rows = parseRanking(recorded("22-donation-weekly"));
    expect(rows.find((r) => r.rank === 97)?.rankBadge).toBeNull();
  });

  it("drops the viewer's pinned row under the list", () => {
    const rows = parseRanking(recorded("25-donation-weekly"));
    expect(rows).toHaveLength(7);
    expect(rows.some((r) => r.value === 36850)).toBe(false);
    expect(rows.at(-1)).toMatchObject({ rank: 77, name: "oOLagerthaOo" });
  });

  it("drops a pinned row that was read, with its own rank and value", () => {
    // Picture 22 pins the viewer's row 58 (36,850) under rows 94 to 100.
    const rows = parseRanking(recorded("22-donation-weekly"));
    expect(rows.map((r) => r.rank)).toEqual([94, 95, 96, 97, 98, 99, 100]);
    expect(rows.some((r) => r.value === 36850)).toBe(false);
  });

  it("flags a value above the row before", () => {
    const lines = recorded("22-donation-weekly").map((l) => l.replace("13,450", "23,450"));
    expect(parseRanking(lines).map((r) => r.flags)).toEqual([[], [], ["order"], [], [], [], []]);
  });

  it("returns a row whose value was not read with null and the flag", () => {
    const lines = recorded("23-donation-weekly").map((l) => l.replace(" 24,050", ""));
    const rows = parseRanking(lines);
    expect(rows).toHaveLength(7);
    expect(rows[2]).toMatchObject({
      rank: 89,
      name: "SnowPug",
      value: null,
      flags: ["points"],
    });
    expect(rows[3]).toMatchObject({ rank: 90, value: 22600, flags: [] });
  });

  it("flags the row after a row that is missing from the lines", () => {
    const lines = recorded("23-donation-weekly").filter((l) => !l.includes("SnowPug"));
    const rows = parseRanking(lines);
    expect(rows).toHaveLength(6);
    expect(rows.find((r) => r.name === "Kacper6741")?.flags).toContain("gap");
  });

  it("reads might and kills pages, the green own row and the medal rows included", () => {
    const might = parseRanking(recorded("90-might-phone"));
    expect(might.map((r) => [r.rank, r.value])).toEqual([
      [1, 111555619],
      [2, 74417492],
      [3, 71338719],
      [4, 71255512],
      [5, 71229930],
      [6, 69411755],
      [7, 67100241],
    ]);
    // Row 4 is the uploader's own row, white on green, and its pinned copy is dropped.
    expect(might[3]).toMatchObject({ name: "Lordanirosan", flags: [] });
    const kills = parseRanking(recorded("89-kills-phone"));
    expect(kills.map((r) => r.value)).toEqual([
      5859680, 4004996, 3777358, 2666082, 2581571, 2221649, 2040923,
    ]);
  });

  it("reads the phone donation pages, weekly and daily, medal rows and own row included", () => {
    for (const fixture of ["87-donation-weekly-phone", "88-donation-daily-phone"]) {
      const rows = parseRanking(recorded(fixture));
      expect(rows.map((r) => [r.rank, r.value])).toEqual([
        [1, 9750],
        [2, 9750],
        [3, 9650],
        [4, 9100],
        [5, 8400],
        [6, 8300],
      ]);
      expect(rows.every((r) => r.flags.length === 0)).toBe(true);
    }
  });

  it("keeps the medal rows 1 to 3 when the row after them is missing, and flags the gap", () => {
    // Picture 88 without its green own row (rank 4): the old inference counted back from rank 5
    // and gave the medal rows 2, 3 and 4.
    const lines = recorded("88-donation-daily-phone").filter((l) => !l.startsWith("4 1 +"));
    const rows = parseRanking(lines);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 5, 6]);
    expect(rows.map((r) => r.flags)).toEqual([[], [], [], ["gap"], []]);
  });

  it("ignores the tab and status bar lines above the column header", () => {
    const rows = parseRanking([
      "18:57 71",
      "Might Kills Donation 3",
      "Rank Doctor Kills",
      "4 Alpha 1,000",
    ]);
    expect(rows.map((r) => [r.rank, r.name, r.value])).toEqual([[4, "Alpha", 1000]]);
  });

  it("reads values written with dots, spaces or narrow no-break spaces", () => {
    const rows = parseRanking([
      "1 | Alpha 100.123",
      "2 Beta 50 000",
      "3 Gamma 1\u202F000",
      "4 Delta 900",
    ]);
    expect(rows.map((r) => r.value)).toEqual([100123, 50000, 1000, 900]);
  });
});
