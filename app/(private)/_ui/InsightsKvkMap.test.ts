// Insights → KvK's map (issues 791, 817, D163): one drawn house a member with its name under it, a shield ring
// or a dashed ring with "no reading" in the readout (not on the map's name labels), the two "as of" lines, the readout naming the first member with ‹ › steps by
// name, and each near/mid/far row naming its members; the plot, the readout and the table sit inside
// ph-no-capture, posthog-js's block class (.claude/rules/private.md). Invented names, places and kills.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { kvkMapOf } from "@/lib/private/kvk-map";

import { KvkMapCard, keepOutOf, labelsOf, type Box } from "./InsightsKvkMap";

vi.mock("@/lib/env", () => ({ getEnv: () => ({ SERVER_TZ: "Etc/GMT+2" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const AT0 = new Date("2026-11-21T09:45:00Z");
const map = kvkMapOf(
  {
    at: new Date("2026-11-21T14:00:00Z"),
    endAt: new Date("2026-11-21T16:00:00Z"),
    unplaced: 1,
    places: [
      { uid: 4, name: "Dawn", x: 431, y: 612, before: 50, after: 50 },
      { uid: 2, name: "Birch", x: 437, y: 618, before: 50, after: 61 },
      { uid: 3, name: "Cedar", x: 452, y: 640, before: 50, after: 97 },
      { uid: 1, name: "Alder", x: 470, y: 655, before: null, after: 70 },
    ],
  },
  { x: 440, y: 620 },
  [
    { uid: 2, shielding: 1, shieldType: 0, mapAt: new Date("2026-11-21T09:40:00Z"), readAt: AT0 },
    { uid: 3, shielding: 0, shieldType: 0, mapAt: new Date("2026-11-21T09:35:00Z"), readAt: AT0 },
  ],
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
    // One house a member in name order, each with its name; the readout opens on the first.
    expect([...figure.matchAll(/data-glyph="(\w+)"/g)].map((m) => m[1])).toEqual([
      "unknown",
      "on",
      "not_seen",
      "unknown",
    ]);
    expect(
      [...figure.matchAll(/<span data-at="\d+"[^>]*><bdi[^>]*>([^<]+)/g)].map((m) => m[1]),
    ).toEqual(["Alder", "Birch", "Cedar", "Dawn"]);
    // Shield seen: the light ring; no reading: the dashed ring, its words only in the readout and the legend,
    // never "unshielded" (D75). Each map label is the name only.
    expect(figure.match(/fill-opacity="0.14"/g)).toHaveLength(1);
    expect(figure).not.toMatch(/>no reading</);
    expect(html).not.toMatch(/unshielded/i);
    expect(figure).toMatch(
      /Alder<\/span> · X 470, Y 655 · Kills not known \(not in the Start reading\) · no reading/,
    );
    // Two "as of" lines: places at the End reading, shields at the newest map scan (ST is UTC-2 here).
    expect(html).toContain("Places as of Sat, Nov 21, 14:00 ST (End reading).");
    expect(html).toContain("Shields as of Sat, Nov 21, 07:40 ST (newest map scan before KvK).");
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

describe("the KvK map's name labels (issue 817)", () => {
  const overlaps = (a: Box, b: Box) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it("keeps every name off the castle in a dense cluster with a member right beside it", () => {
    const castle = { cx: 50, cy: 50 };
    const spots = [
      [61, 50],
      [70, 41],
      [72, 49],
      [68, 57],
      [76, 54],
      [65, 43],
      [58, 61],
    ] as const;
    // Short names, so each member has at least one spot inside the plot that is clear of the castle.
    const names = ["Ash", "Oak", "Elm", "Fir", "Yew", "Ivy", "Bay"];
    const dots = spots.map(([x, y], i) => ({
      name: names[i] as string,
      x,
      y,
      band: null,
      shield: "unknown" as const,
    }));
    const boxes = labelsOf(
      dots,
      spots.map(([cx, cy]) => ({ cx, cy })),
      castle,
    );
    const keep = keepOutOf(castle);
    expect(boxes).toHaveLength(spots.length);
    for (const b of boxes) {
      expect(overlaps(b, keep)).toBe(false);
      expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= 100 && b.y + b.h <= 100).toBe(true);
    }
  });
});
