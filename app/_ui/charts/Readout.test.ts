// The readout under a chart (D158 rule 7 (a)): the column the address fragment names after Back, and the line
// it starts on. Invented values.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { atOf, Readout } from "./Readout";

describe("the readout under a chart", () => {
  it("takes back only its own column from the fragment, inside the chart's columns", () => {
    expect(atOf("#at-pulse-3", "pulse", 8)).toBe(3);
    expect(atOf("#at-pulse-0", "pulse", 8)).toBe(0);
    // Past the last column, another chart's readout, or a fragment it does not own.
    for (const hash of [
      "#at-pulse-8",
      "#at-kills-3",
      "#at-pulse-",
      "#who-range-0",
      "",
      "#at-pulse-1x",
    ])
      expect(atOf(hash, "pulse", 8)).toBeNull();
  });

  it("starts on the column it is given and names it with its numbers, with 44 px steps", () => {
    const html = renderToStaticMarkup(
      createElement(Readout, {
        id: "pulse",
        items: [
          { label: "11:00–11:15", line: "4.1K kills gained · 5 alliances read" },
          { label: "11:15–11:30", line: "10.2K kills gained · 5 alliances read" },
        ],
        initial: 1,
        words: { earlier: "Earlier", later: "Later" },
        children: createElement("ul"),
      }),
    );
    expect(html).toContain("11:15–11:30</span> · 10.2K kills gained · 5 alliances read");
    expect(html).not.toContain("4.1K kills");
    // The last column has no later one: its step is off; the earlier one is on.
    expect(html).toMatch(/aria-label="Later" disabled=""/);
    expect(html).not.toMatch(/aria-label="Earlier" disabled=""/);
    expect(html.match(/min-h-11 min-w-11/g)).toHaveLength(2);
  });
});
