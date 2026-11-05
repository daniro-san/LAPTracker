// DESIGN.md ornament budget: the search's pending drawing is one original single-colour inline SVG
// under 4 KB as rendered, hidden from assistive technology (the status line speaks for it).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GrannyLedger } from "./Mascot";

describe("GrannyLedger", () => {
  it("renders under 4,096 bytes, aria-hidden, in currentColor only", () => {
    const html = renderToStaticMarkup(createElement(GrannyLedger, { className: "w-40 text-plum" }));

    expect(Buffer.byteLength(html)).toBeLessThan(4096);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-anim="scan"');
    expect(html).not.toMatch(/#[0-9a-f]{3,6}|rgb\(|<text|<mask|<clipPath|opacity|id=/i);
  });
});
