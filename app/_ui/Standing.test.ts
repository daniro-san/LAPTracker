import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";
import type { StandingRow } from "@/lib/standing";

import { makeClock } from "./format";
import { StandingBody } from "./Standing";

const row = (unionId: number, ranks: number[], might: number): StandingRow => ({
  unionId,
  tag: `T${unionId}`,
  name: `Alliance ${unionId}`,
  badgeId: null,
  might,
  rank: ranks.at(-1) as number,
  ranks,
  move: (ranks[0] as number) - (ranks.at(-1) as number),
  growth: 1,
});

describe("Standing over time (D90, D158)", () => {
  it("says where a row stood on the first day only when its rank moved", () => {
    const html = renderToStaticMarkup(
      createElement(StandingBody, {
        standing: {
          days: ["2026-11-14", "2026-11-17", "2026-11-21"],
          notRanked: [],
          // Alliances 2, 1 and 3 moved; alliance 4 held #4 every day.
          rows: [
            row(2, [3, 2, 1], 400),
            row(1, [1, 1, 2], 300),
            row(3, [2, 3, 3], 200),
            row(4, [4, 4, 4], 100),
          ],
          serverMight: 600,
          serverGrowth: 1,
        },
        unionId: 1,
        details: false,
        clock: makeClock("en", "Etc/GMT+2"),
        locale: "en",
        copy: en,
      }),
    );
    expect(html.match(/was #\d on Nov 14/g)).toEqual([
      "was #3 on Nov 14",
      "was #1 on Nov 14",
      "was #2 on Nov 14",
    ]);
    expect(html).toContain("Alliance 4");
  });
});
