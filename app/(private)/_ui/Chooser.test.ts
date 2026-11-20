import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { Chooser } from "./Chooser";

const t = WORKSPACE_DICTIONARIES.en;

describe("/w's body (D131)", () => {
  it("says a sign-in found no alliance, above the alliances this device already holds", () => {
    const rows = [
      { slug: "ogs", tag: "OGs", name: "OldGrandmas", tier: "officer" as const, href: "/w/ogs" },
    ];
    const html = renderToStaticMarkup(createElement(Chooser, { rows, e: "none", t }));
    const none = html.indexOf(t["chooser.none"]);
    expect(none).toBeGreaterThan(-1);
    expect(none).toBeLessThan(html.indexOf('href="/w/ogs"'));
  });
});
