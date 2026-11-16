import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AllianceTurnout } from "@/lib/queries";

import { visibleEntries, WhoFought } from "./WhoFought";

const alliance = (unionId: number, gainers: number, over: Partial<AllianceTurnout> = {}) => ({
  unionId,
  tag: `T${unionId}`,
  name: `Alliance ${unionId}`,
  badgeId: null,
  n: 50,
  gainers,
  gained: 100,
  top: 90,
  ...over,
});
const render = (withKills: AllianceTurnout[], topShare: AllianceTurnout[]) =>
  renderToStaticMarkup(createElement(WhoFought, { eventId: 7, lists: { withKills, topShare } }));

describe("WhoFought", () => {
  it("lets a long tag and name shrink inside its column instead of widening the page", () => {
    const long = alliance(1, 20, { tag: "ABCDEFG", name: "N".repeat(24) });
    const html = render([long], [long]);
    expect(html.match(/<div class="min-w-0">/g)).toHaveLength(2);
    expect(html).toContain("min-w-0 flex-1 truncate");
    expect(html).toContain("lg:grid-cols-2");
  });

  it("shows the first 5 rows of a list and the rest behind Show all", () => {
    const eight = Array.from({ length: 8 }, (_, i) => alliance(i + 1, 20));
    const html = render(eight, eight);
    expect(html.match(/href="\/events\/7\/alliances\/\d+"/g)).toHaveLength(10);
    expect(html.match(/Show all \(8\)/g)).toHaveLength(2);
  });

  it("gives the top share its basis, and an alliance with few gainers 'few gainers', muted", () => {
    const html = render([], [alliance(1, 47), alliance(2, 7)]);
    expect(html).toContain("90% · 5 of 47");
    expect(html).toContain("90% · few gainers");
    expect(html.match(/text-ink\/70"><a/g)).toHaveLength(1);
  });

  describe("visibleEntries", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ t: { unionId: i + 1 } }));
    const ids = (r: typeof rows) => r.map(({ t }) => t.unionId);

    it("shows the first 5 when the viewer's alliance is among them", () => {
      expect(ids(visibleEntries(rows, 3, false))).toEqual([1, 2, 3, 4, 5]);
    });
    it("adds the viewer's alliance in place when it is outside the first 5", () => {
      expect(ids(visibleEntries(rows, 7, false))).toEqual([1, 2, 3, 4, 5, 7]);
    });
    it("shows the first 5 when there is no own alliance", () => {
      expect(ids(visibleEntries(rows, null, false))).toEqual([1, 2, 3, 4, 5]);
    });
    it("shows every row when expanded", () => {
      expect(visibleEntries(rows, 7, true)).toHaveLength(8);
    });
  });
});
