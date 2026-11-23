import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";
import { textOf } from "@/lib/html.test-helpers";
import { fill } from "@/lib/words";

import { PulseSplit } from "./PulseSplit";

const labels = new Map([
  [1, "[IRT] Iron Thistle"],
  [2, "[MNW] Moonwake"],
]);

describe("an interval's split by alliance (D158 rule 7 (b))", () => {
  it("draws a loss as 0, so the shares are of the gains and none passes 100 %, and names who lost", () => {
    // +100 and −20: the interval's net is 80, but the bars and shares are of the 100 gained.
    const html = renderToStaticMarkup(
      createElement(PulseSplit, {
        parts: [
          { unionId: 1, kills: 100 },
          { unionId: 2, kills: -20 },
        ],
        kills: 80,
        read: [1, 2],
        times: { from: "10:45", to: "11:00" },
        labels,
        copy: en,
        locale: "en-GB",
      }),
    );
    const text = textOf(html);
    const shares = [...text.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
    expect(shares).toEqual([100, 0]);
    expect(text).toContain(fill(en.ledger.splitKey, { kills: "100" }));
    expect(text).toContain(fill(en.ledger.splitLossPart, { names: "[MNW] Moonwake" }));
    // The sum line keeps the interval's own net figure, the one its column draws.
    expect(text).toContain(
      fill(en.ledger.splitSum, {
        kills: "80",
        span: "10:45–11:00",
        n: 2,
        from: "10:45",
        to: "11:00",
      }),
    );
  });
});
