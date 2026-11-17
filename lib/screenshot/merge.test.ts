import { describe, expect, it } from "vitest";

import { mergePages } from "./merge";
import { parseAllianceDuelRanking } from "./parse-alliance-duel";
import { recorded } from "./test-helpers";

const weekly = { scope: "weekly" } as const;
const page = (name: string) =>
  parseAllianceDuelRanking(recorded(name), weekly).map((r) => ({ ...r, value: r.points }));

describe("mergePages", () => {
  it("merges scrolled pages of one ranking in rank order, each row once", () => {
    const first = page("27-alliance-duel-weekly-mine");
    const second = page("28-alliance-duel-weekly-mine");
    // The second picture sent twice, and before the first: the order and the duplicates do not matter.
    const merged = mergePages([second, first, second]);
    expect(merged.map((r) => r.rank)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(merged.every((r) => !r.flags.includes("gap"))).toBe(true);
  });

  it("flags the first row after a page that is missing", () => {
    const merged = mergePages([
      page("27-alliance-duel-weekly-mine"),
      page("29-alliance-duel-weekly-mine"),
    ]);
    expect(merged.map((r) => r.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20, 21, 22, 23, 24,
    ]);
    expect(merged[8]?.flags).toContain("gap");
  });
});
