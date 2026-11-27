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
bq47mzk
[OGs]OldGrandmas
174,488,831
Tavish•Fearne
[OGs]OldGrandmas
97,060,474
Kei43NOR
[OGs]OldGrandmas
90,772,562
4
Thistlemoore
[OGs]OldGrandmas
87,244,291
15
MissPickles
[OGs]OldGrandmas
66,777,646
My Alliance`;
    const result = parseRankingPaste(paste);
    expect(result.rows).toEqual([
      row(1, "bq47mzk", 174488831),
      row(2, "Tavish•Fearne", 97060474),
      row(3, "Kei43NOR", 90772562),
      row(4, "Thistlemoore", 87244291),
    ]);
    expect(result.pinned).toEqual(row(15, "MissPickles", 66777646));
  });

  it("reads a Donation paste whose R-badges are lines of their own", () => {
    const paste = `Might Ranking
Rank
Doctor
Contribution
94
marvelo
16,500
95
R2
Wendrel
15,500
58
R4
MissPickles
36,850
Donate`;
    const result = parseRankingPaste(paste);
    expect(result.rows).toEqual([row(94, "marvelo", 16500), row(95, "Wendrel", 15500)]);
    expect(result.pinned).toEqual(row(58, "MissPickles", 36850));
  });

  it("keeps the viewer's real row when the pinned row repeats it", () => {
    const paste = `15
MissPickles
[OGs]OldGrandmas
66,777,646
16
Edda8412
[OGs]OldGrandmas
66,386,203
15
MissPickles
[OGs]OldGrandmas
66,777,646`;
    const result = parseRankingPaste(paste);
    expect(result.rows.map((r) => r.rank)).toEqual([15, 16]);
    expect(result.pinned?.rank).toBe(15);
  });

  it("zips a column-wise paste of ranks, names and values", () => {
    const result = parseRankingPaste(
      "4\n5\n6\nThistlemoore\nMossOwl\nhithereyall\n87,244,291\n84,302,976\n81,352,526",
    );
    expect(result.rows).toEqual([
      row(4, "Thistlemoore", 87244291),
      row(5, "MossOwl", 84302976),
      row(6, "hithereyall", 81352526),
    ]);
    expect(result.pinned).toBeNull();
  });

  it("reads one-line rows with the tag dropped and look-alike letters in the number", () => {
    const result = parseRankingPaste(
      "17 frankfox77 [OGs]OldGrandmas 64,920,I34\n18 taraDoc 60,965,737",
    );
    expect(result.rows).toEqual([row(17, "frankfox77", 64920134), row(18, "taraDoc", 60965737)]);
  });

  it("keeps the last row when no rank was read and its value does not rise", () => {
    const result = parseRankingPaste(
      "Thistlemoore\nMossOwl\nhithereyall\n87,244,291\n84,302,976\n81,352,526",
    );
    expect(result.rows).toHaveLength(3);
    expect(result.pinned).toBeNull();
  });
});
