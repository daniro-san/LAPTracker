import { describe, expect, it } from "vitest";

import { parseAllianceDuelRanking } from "./parse-alliance-duel";
import { recorded } from "./test-helpers";

const weekly = { scope: "weekly" } as const;

describe("parseAllianceDuelRanking", () => {
  it("reads the rows of a My Alliance page with their points exact", () => {
    const rows = parseAllianceDuelRanking(recorded("27-alliance-duel-weekly-mine"), weekly);
    expect(rows.map((r) => r.points)).toEqual([
      174488831, 97060474, 90772562, 87244291, 84302976, 81352526, 77384266, 77185919,
    ]);
    expect(rows.slice(1).map((r) => r.name)).toEqual([
      "Thome",
      "Zsu78HUN",
      "Lordanirosan",
      "viris",
      "SnowPug",
      "helloallyou",
      "Kilare",
    ]);
  });

  it("gives the medal rows 1 to 3 their ranks from their place", () => {
    const rows = parseAllianceDuelRanking(recorded("27-alliance-duel-weekly-mine"), weekly);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("numbers a later page from the ranks it shows", () => {
    const rows = parseAllianceDuelRanking(recorded("30-alliance-duel-weekly-mine"), weekly);
    expect(rows.map((r) => r.rank)).toEqual([25, 26, 27, 28, 29, 30, 31, 32]);
  });

  it("drops the viewer's pinned row under the list", () => {
    const rows = parseAllianceDuelRanking(recorded("27-alliance-duel-weekly-mine"), weekly);
    expect(rows).toHaveLength(8);
    expect(rows.some((r) => r.points === 66777646)).toBe(false);
  });

  it("keeps the viewer's real row and drops its pinned copy", () => {
    const rows = parseAllianceDuelRanking(recorded("28-alliance-duel-weekly-mine"), weekly);
    expect(rows.map((r) => r.rank)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    expect(rows.filter((r) => r.points === 66777646)).toHaveLength(1);
  });

  it("reads each row's alliance tag, other alliances included", () => {
    const rows = parseAllianceDuelRanking(recorded("26-alliance-duel-weekly-server"), weekly);
    expect(rows[2]).toMatchObject({ rank: 3, name: "Derek-Tom", tag: "Ratz", points: 91311092 });
    expect(rows[3]?.tag).toMatch(/^[O0]Gs$/);
  });

  it("tags every row with the scope and the day it was read for", () => {
    const rows = parseAllianceDuelRanking(recorded("29-alliance-duel-weekly-mine"), {
      scope: "daily",
      day: "2026-11-14",
    });
    expect(rows.every((r) => r.scope === "daily" && r.day === "2026-11-14")).toBe(true);
  });

  it("flags a row whose points are above the row before", () => {
    const lines = recorded("27-alliance-duel-weekly-mine").map((l) =>
      l.replace("81,352,526", "91,352,526"),
    );
    const rows = parseAllianceDuelRanking(lines, weekly);
    expect(rows.map((r) => r.flags)).toEqual([[], [], [], [], [], ["order"], [], []]);
  });

  it("flags a rank the picture reads differently, and keeps the ranks around it", () => {
    // The OCR read the 31 of the seventh row of this page as a 3.
    const rows = parseAllianceDuelRanking(recorded("30-alliance-duel-weekly-mine"), weekly);
    expect(rows[6]).toMatchObject({ rank: 31, flags: ["rank"] });
    expect(rows.map((r) => r.rank)).toEqual([25, 26, 27, 28, 29, 30, 31, 32]);
  });

  it("reads a phone picture's rows, medal rows and the day tab included, and drops the pinned own row", () => {
    const rows = parseAllianceDuelRanking(recorded("99-alliance-duel-daily-phone"), weekly);
    expect(rows.map((r) => [r.rank, r.points])).toEqual([
      [1, 22961474],
      [2, 18345893],
      [3, 14800884],
      [4, 12401468],
      [5, 11146597],
      [6, 10850521],
      [7, 10167223],
    ]);
  });

  it("drops the pinned row under a full page even when its rank was not read", () => {
    // Picture 98: eight rows, then the uploader's row 76 whose rank the OCR lost.
    const rows = parseAllianceDuelRanking(recorded("98-alliance-duel-weekly-phone"), weekly);
    expect(rows).toHaveLength(8);
    expect(rows.some((r) => r.points === 2479687)).toBe(false);
  });

  it("returns a row whose number was not read with null points and the flag", () => {
    // Row 6 loses its points line; its name and tag lines stay.
    const lines = recorded("27-alliance-duel-weekly-mine").map((l) =>
      l.replace("6 81,352,526", "6"),
    );
    const rows = parseAllianceDuelRanking(lines, weekly);
    expect(rows).toHaveLength(8);
    expect(rows[5]).toMatchObject({ rank: 6, name: "SnowPug", points: null, flags: ["points"] });
    expect(rows[6]).toMatchObject({ rank: 7, name: "helloallyou", flags: [] });
  });

  it("flags the row after a row that is missing from the lines", () => {
    // Row 6 is removed whole: name, points and tag lines.
    const lines = recorded("27-alliance-duel-weekly-mine");
    lines.splice(lines.findIndex((l) => l.includes("81,352,526")) - 1, 3);
    const rows = parseAllianceDuelRanking(lines, weekly);
    expect(rows).toHaveLength(7);
    expect(rows[5]?.flags).toContain("gap");
  });

  it("reads numbers written with dots, spaces or narrow no-break spaces, after a rank", () => {
    const tag = "[OGs]Old";
    const rows = parseAllianceDuelRanking(
      ["Alpha", "97 1.234.567", tag, "Beta", "98 1\u202F000\u202F000", tag].concat([
        "Gamma",
        "99 900 000",
        tag,
        "Delta",
        "100 123,456",
        tag,
      ]),
      weekly,
    );
    expect(rows.map((r) => [r.rank, r.points])).toEqual([
      [97, 1234567],
      [98, 1000000],
      [99, 900000],
      [100, 123456],
    ]);
  });
});
