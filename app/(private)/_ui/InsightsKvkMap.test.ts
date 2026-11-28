// Insights → KvK's map (issue 791) in session replay: the plot and the near/mid/far table sit inside
// ph-no-capture, posthog-js's block class (.claude/rules/private.md), and the markup names no member and
// carries no uid. Invented places and kills.
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
      { x: 431, y: 612, before: 50, after: 50 },
      { x: 437, y: 618, before: 50, after: 61 },
      { x: 452, y: 640, before: 50, after: 97 },
      { x: 470, y: 655, before: null, after: 70 },
    ],
  },
  { x: 440, y: 620 },
);

describe("the KvK map card in session replay (issue 791)", () => {
  it("keeps the plot and the near/mid/far table inside ph-no-capture, with no name or uid", () => {
    const html = renderToStaticMarkup(
      createElement(KvkMapCard, {
        map,
        slug: "alpha",
        t: WORKSPACE_DICTIONARIES.en,
        language: "en",
      }),
    );
    const plot = html.match(/<svg[^>]*viewBox="0 0 100 100"[^>]*>/)?.[0] ?? "";
    expect(plot).toMatch(/class="ph-no-capture /);
    expect(html.match(/<table[^>]*>/)?.[0]).toMatch(/class="ph-no-capture /);
    expect(html).toContain("Near");
    // The view has no uid or name to give, and nothing in the markup stands for one.
    expect(html).not.toMatch(/uid|Example|data-member/i);
  });
});
