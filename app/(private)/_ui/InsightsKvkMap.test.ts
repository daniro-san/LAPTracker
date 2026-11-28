// Insights → KvK's map (issue 791, D163): the readout names the first dot's member, with ‹ › steps by name,
// and each near/mid/far row names its members; the plot, the readout and the table sit inside ph-no-capture,
// posthog-js's block class (.claude/rules/private.md). Invented names, places and kills.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { kvkMapOf } from "@/lib/private/kvk-map";

import { KvkMapCard } from "./InsightsKvkMap";

vi.mock("@/lib/env", () => ({ getEnv: () => ({ SERVER_TZ: "Etc/GMT+2" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const map = kvkMapOf(
  {
    at: new Date("2026-11-21T14:00:00Z"),
    endAt: new Date("2026-11-21T16:00:00Z"),
    unplaced: 1,
    places: [
      { name: "Dawn", x: 431, y: 612, before: 50, after: 50 },
      { name: "Birch", x: 437, y: 618, before: 50, after: 61 },
      { name: "Cedar", x: 452, y: 640, before: 50, after: 97 },
      { name: "Alder", x: 470, y: 655, before: null, after: 70 },
    ],
  },
  { x: 440, y: 620 },
);

describe("the KvK map card (issue 791, D163)", () => {
  it("names the dots in a readout and each band's members, inside ph-no-capture", () => {
    const html = renderToStaticMarkup(
      createElement(KvkMapCard, {
        map,
        slug: "alpha",
        t: WORKSPACE_DICTIONARIES.en,
        language: "en",
      }),
    );
    const figure = html.slice(html.indexOf("<figure"), html.indexOf("</figure>"));
    expect(html.match(/<figure[^>]*>/)?.[0]).toMatch(/class="ph-no-capture /);
    // Dots in name order; the readout opens on the first, with its place and band.
    expect(figure.match(/data-at="\d+"/g)).toHaveLength(4);
    expect(figure).toMatch(/Alder<\/span> · X 470, Y 655 · Kills not known/);
    expect(figure).toContain('aria-label="Next member by name"');
    const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
    expect(html.match(/<table[^>]*>/)?.[0]).toMatch(/class="ph-no-capture /);
    // Kills are known for 3 members, so one a third: Birch nearest the castle point, then Dawn, then Cedar.
    expect([...table.matchAll(/<bdi[^>]*>([^<]+)<\/bdi>/g)].map((m) => m[1])).toEqual([
      "Birch",
      "Dawn",
      "Cedar",
    ]);
    expect(table).toContain("Who (1)");
  });
});
