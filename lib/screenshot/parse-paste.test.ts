import { describe, expect, it } from "vitest";

import { parseRankingPaste } from "./parse-paste";

const row = (rank: number, name: string, value: number) => ({ rank, name, value });

describe("parseRankingPaste", () => {
  it("reads an Alliance Duel paste, numbers the medal rows and returns the pinned row apart", () => {
    const paste = `Rank
Daily
Weekly
Rank
Player
Point
ny21dvl
[OGs]OldGrandmas
174,488,831
Kasoar•Thorne
[OGs]OldGrandmas
97,060,474
Zsu78HUN
[OGs]OldGrandmas
90,772,562
4
Lordanirosan
[OGs]OldGrandmas
87,244,291
15
MissJackson
[OGs]OldGrandmas
66,777,646
My Alliance`;
    const result = parseRankingPaste(paste);
    expect(result.rows).toEqual([
      row(1, "ny21dvl", 174488831),
      row(2, "Kasoar•Thorne", 97060474),
      row(3, "Zsu78HUN", 90772562),
      row(4, "Lordanirosan", 87244291),
    ]);
    expect(result.pinned).toEqual(row(15, "MissJackson", 66777646));
  });

  it("reads a Donation paste whose R-badges are lines of their own", () => {
    const paste = `Might Ranking
Rank
Doctor
Contribution
94
corvudo
16,500
95
R2
Theriel
15,500
58
R4
MissJackson
36,850
Donate`;
    const result = parseRankingPaste(paste);
    expect(result.rows).toEqual([row(94, "corvudo", 16500), row(95, "Theriel", 15500)]);
    expect(result.pinned).toEqual(row(58, "MissJackson", 36850));
  });

  it("keeps the viewer's real row when the pinned row repeats it", () => {
    const paste = `15
MissJackson
[OGs]OldGrandmas
66,777,646
16
Anna8603
[OGs]OldGrandmas
66,386,203
15
MissJackson
[OGs]OldGrandmas
66,777,646`;
    const result = parseRankingPaste(paste);
    expect(result.rows.map((r) => r.rank)).toEqual([15, 16]);
    expect(result.pinned?.rank).toBe(15);
  });

  it("zips a column-wise paste of ranks, names and values", () => {
    const result = parseRankingPaste(
      "4\n5\n6\nLordanirosan\nSnowPug\nhelloallyou\n87,244,291\n84,302,976\n81,352,526",
    );
    expect(result.rows).toEqual([
      row(4, "Lordanirosan", 87244291),
      row(5, "SnowPug", 84302976),
      row(6, "helloallyou", 81352526),
    ]);
    expect(result.pinned).toBeNull();
  });

  it("reads one-line rows with the tag dropped and look-alike letters in the number", () => {
    const result = parseRankingPaste(
      "17 dannyboy90 [OGs]OldGrandmas 64,920,I34\n18 meonDoc 60,965,737",
    );
    expect(result.rows).toEqual([row(17, "dannyboy90", 64920134), row(18, "meonDoc", 60965737)]);
  });

  it("keeps the last row when no rank was read and its value does not rise", () => {
    const result = parseRankingPaste(
      "Lordanirosan\nSnowPug\nhelloallyou\n87,244,291\n84,302,976\n81,352,526",
    );
    expect(result.rows).toHaveLength(3);
    expect(result.pinned).toBeNull();
  });
});
