import { describe, expect, it } from "vitest";

import type { Ranks } from "@/lib/queries";

import { comparisonRows, type Snap } from "./event-rows";

const cell = (unionId: number, tag: string, power: number, failed = false) => ({
  unionId,
  tag,
  name: tag,
  totalPower: failed ? null : power,
  totalKills: failed ? null : 1,
  memberCount: failed ? null : 1,
  isFresh: !failed,
  failed,
});

const snap = (phase: "before" | "after", alliances: ReturnType<typeof cell>[]) =>
  ({ phase, alliances }) as unknown as Snap;

describe("comparisonRows", () => {
  it("gives an alliance whose after fetch failed no rank and puts it after the ranked ones (07c S8)", () => {
    // Event 1 of the seed: IMPA (#12 before) fails after; PSY moves 13 → 12.
    const ranks = new Map<number, Partial<Record<"before" | "after", Ranks>>>([
      [1, { before: { might: 12, kills: 12 } }],
      [2, { before: { might: 13, kills: 13 }, after: { might: 12, kills: 12 } }],
    ]);
    const rows = comparisonRows(
      [
        snap("before", [cell(1, "IMPA", 20), cell(2, "PSY", 10)]),
        snap("after", [cell(1, "IMPA", 0, true), cell(2, "PSY", 11)]),
      ],
      new Map(),
      new Map(),
      ranks,
    );
    expect(rows.map((r) => [r.tag, r.rank])).toEqual([
      ["PSY", 12],
      ["IMPA", null],
    ]);
    expect(rows[1]?.ranks.might.before).toBe(12);
  });
});
