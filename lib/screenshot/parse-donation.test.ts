import { describe, expect, it } from "vitest";

import { parseDonationRanking } from "./parse-donation";
import { recorded } from "./test-helpers";

describe("parseDonationRanking", () => {
  it("reads rank, name and contribution of each row", () => {
    const rows = parseDonationRanking(recorded("23-donation-weekly"));
    expect(rows.map((r) => [r.rank, r.contribution])).toEqual([
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
    const rows = parseDonationRanking(recorded("24-donation-weekly"));
    expect(rows.map((r) => r.rankBadge)).toEqual([null, 2, 3, 3, 3, 3, 2]);
  });

  it("leaves the badge empty when its text was misread", () => {
    const rows = parseDonationRanking(recorded("22-donation-weekly"));
    expect(rows.find((r) => r.rank === 97)?.rankBadge).toBeNull();
  });

  it("drops the viewer's pinned row under the list", () => {
    const rows = parseDonationRanking(recorded("25-donation-weekly"));
    expect(rows).toHaveLength(7);
    expect(rows.some((r) => r.contribution === 36850)).toBe(false);
    expect(rows.at(-1)).toMatchObject({ rank: 77, name: "oOLagerthaOo" });
  });

  it("drops a pinned row that was read, with its own rank and contribution", () => {
    const page = recorded("22-donation-weekly");
    const last = page.findIndex((l) => l.includes("Theriel"));
    const lines = [...page.slice(0, last + 1), "58 | MissJackson 36,850", ...page.slice(last + 1)];
    const rows = parseDonationRanking(lines);
    expect(rows.map((r) => r.rank)).toEqual([94, 95, 96, 97, 98, 99, 100]);
  });

  it("flags a contribution above the row before", () => {
    const lines = recorded("22-donation-weekly").map((l) => l.replace("13,450", "23,450"));
    expect(parseDonationRanking(lines).map((r) => r.flags)).toEqual([
      [],
      [],
      ["order"],
      [],
      [],
      [],
      [],
    ]);
  });

  it("returns a row whose contribution was not read with null and the flag", () => {
    const lines = recorded("23-donation-weekly").map((l) => l.replace(" 24,050", ""));
    const rows = parseDonationRanking(lines);
    expect(rows).toHaveLength(7);
    expect(rows[2]).toMatchObject({
      rank: 89,
      name: "snowpug",
      contribution: null,
      flags: ["points"],
    });
    expect(rows[3]).toMatchObject({ rank: 90, contribution: 22600, flags: [] });
  });

  it("flags the row after a row that is missing from the lines", () => {
    const lines = recorded("23-donation-weekly").filter((l) => !l.includes("snowpug"));
    const rows = parseDonationRanking(lines);
    expect(rows).toHaveLength(6);
    expect(rows.find((r) => r.name === "Kacper6741")?.flags).toContain("gap");
  });

  it("reads contributions written with dots, spaces or narrow no-break spaces", () => {
    const rows = parseDonationRanking([
      "1 | Alpha 100.123",
      "2 Beta 50 000",
      "3 Gamma 1\u202F000",
      "4 Delta 900",
    ]);
    expect(rows.map((r) => r.contribution)).toEqual([100123, 50000, 1000, 900]);
  });
});
