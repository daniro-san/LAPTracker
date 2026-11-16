import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Carried, CarriedRow } from "@/lib/queries";

import { visibleRows, WhoCarried } from "./WhoCarried";

const row = (unionId: number, over: Partial<CarriedRow> = {}): CarriedRow => ({
  unionId,
  tag: `T${unionId}`,
  name: `Alliance ${unionId}`,
  badgeId: null,
  mightShare: 0.1,
  killShare: 0.2,
  ratio: null,
  spread: null,
  turnout: null,
  ...over,
});
const render = (rows: CarriedRow[]) =>
  renderToStaticMarkup(
    createElement(WhoCarried, {
      eventId: 7,
      carried: {
        rows,
        totals: { alliances: rows.length, killsGained: 5000, might: 9_000_000 },
      } as Carried,
    }),
  );

describe("WhoCarried", () => {
  describe("visibleRows", () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, i) => row(i + 1)),
      row(8, { mightShare: 0.2, killShare: 0.1 }),
      row(9, { mightShare: 0.3, killShare: 0.05 }),
    ];
    const ids = (r: CarriedRow[]) => r.map((x) => x.unionId);

    it("shows the first 5 rows above their might share, and never a row below it", () => {
      expect(ids(visibleRows(rows, null))).toEqual([1, 2, 3, 4, 5]);
    });
    it("shows every row in the same order once expanded", () => {
      expect(ids(visibleRows(rows, null, true))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
    it("adds the viewer's own alliance wherever it is", () => {
      expect(ids(visibleRows(rows, 9))).toEqual([1, 2, 3, 4, 5, 9]);
    });
  });

  it("shows the ratio with its range for an alliance with enough events, else the gap in points", () => {
    const html = render([
      row(1, { ratio: 2.5, spread: { n: 4, low: 1.8, high: 2.9 } }),
      row(2, { mightShare: 0.1, killShare: 0.161 }),
    ]);
    expect(html).toContain("2.5×");
    expect(html).toContain("1.8×–2.9× over 4 events");
    expect(html).toContain("+6.1 pts");
  });

  it("lets a long tag and name shrink inside the row and links the row to the alliance's page", () => {
    const html = render([row(1, { tag: "ABCDEFG", name: "N".repeat(24) })]);
    expect(html).toContain("min-w-0 flex-1 truncate");
    expect(html).toContain('href="/events/7/alliances/1"');
  });
});
