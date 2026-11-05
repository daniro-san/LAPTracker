import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Clock } from "./format";
import { StatusChips } from "./Status";

const clock = { at: () => "Nov 7, 10:00" } as unknown as Clock;
const html = (manual: boolean) =>
  renderToStaticMarkup(
    createElement(StatusChips, {
      phases: [],
      nextAt: new Date("2026-11-07T10:00:00Z"),
      stale: 0,
      manual,
      clock,
    }),
  );

describe("StatusChips", () => {
  it("says a manual round is run by hand instead of naming the next scheduled update", () => {
    expect(html(false)).toContain("Next update at Nov 7, 10:00");
    const manual = html(true);
    expect(manual).toContain("Run by hand by the admin");
    expect(manual).not.toContain("Next update");
  });
});
