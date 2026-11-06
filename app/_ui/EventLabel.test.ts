import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";

import { EventLabel } from "./EventLabel";
import type { Clock } from "./format";

const clock = { weekday: () => "Saturday" } as unknown as Clock;
const at = new Date("2026-11-07T14:00:00Z");
const html = (event: { name: string; manual: boolean }) =>
  renderToStaticMarkup(
    createElement(EventLabel, { event: { ...event, eventAtUtc: at }, clock, copy: en }),
  );

describe("EventLabel", () => {
  it("tags a manual round with its name as text, and leaves a real event as its weekday", () => {
    expect(html({ name: "Saturday event", manual: false })).toBe("Saturday");
    const manual = html({ name: "<b>teste</b>", manual: true });
    expect(manual).toContain("&lt;b&gt;teste&lt;/b&gt;");
    expect(manual).not.toContain("<b>");
    expect(manual).toContain("Manual round");
  });
});
