import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventLabel } from "./EventLabel";
import type { Clock } from "./format";

const clock = { weekday: () => "Sat, Nov 7" } as unknown as Clock;
const at = new Date("2026-11-07T14:00:00Z");
const html = (event: { name: string; manual: boolean }) =>
  renderToStaticMarkup(createElement(EventLabel, { event: { ...event, eventAtUtc: at }, clock }));

describe("EventLabel", () => {
  it("names an event by its title, as text, and by its date while it keeps its generated name", () => {
    expect(html({ name: "Saturday Event 2026-11-07", manual: false })).toBe("Sat, Nov 7");
    expect(html({ name: "KvK 12-11", manual: false })).toBe("KvK 12-11");
    expect(html({ name: "<b>teste</b>", manual: true })).toBe("&lt;b&gt;teste&lt;/b&gt;");
  });
});
