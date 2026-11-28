import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";

import { changeLine, inRange, rangeOf } from "./growth";

const points = ["2026-09-01", "2026-10-28", "2026-11-20", "2026-11-25", "2026-11-27"].map(
  (day, i) => ({ day, value: 1_000_000 * (i + 1) }),
);
const compactM = (n: number) => `${n / 1_000_000}M`;

describe("growth ranges", () => {
  it("reads 7d, 30d and 90d from the address, else 30 days", () => {
    expect([rangeOf("7d"), rangeOf("90d"), rangeOf("1d"), rangeOf(undefined)]).toEqual([
      7, 90, 30, 30,
    ]);
  });

  it("keeps the days up to the newest reading, both ends included", () => {
    expect(inRange(points, 7).map((p) => p.day)).toEqual([
      "2026-11-20",
      "2026-11-25",
      "2026-11-27",
    ]);
    expect(inRange(points, 30)).toHaveLength(4);
    expect(inRange(points, 90)).toHaveLength(5);
  });
});

describe("changeLine", () => {
  it("says the change over the days between the range's first and last reading", () => {
    expect(changeLine(inRange(points, 7), compactM, en)).toBe("+2M over 7 days");
    const fall = [
      { day: "2026-11-26", value: 5 },
      { day: "2026-11-27", value: 3 },
    ];
    expect(changeLine(fall, String, en)).toBe("−2 over 1 day");
  });

  it("says no change, and leaves the line out with one reading", () => {
    const flat = [
      { day: "2026-11-20", value: 4 },
      { day: "2026-11-27", value: 4 },
    ];
    expect(changeLine(flat, String, en)).toBe("No change over 7 days");
    expect(changeLine(points.slice(-1), String, en)).toBeNull();
  });
});
