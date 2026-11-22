// Home's "Today and tomorrow" (issue 585 slice 4): an entry that is over takes one line, still a link to its
// day; one still to come keeps its two lines. Rendered as the server renders it, on the server's clock.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { textOf } from "@/lib/html.test-helpers";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { calendarWords } from "./calendar-data";
import { HomeNext } from "./HomeNext";

const t = WORKSPACE_DICTIONARIES.en;
const at = (iso: string) => new Date(iso).getTime();
const item = (key: string, title: string, st: string, start: string, end: string) => ({
  key,
  title,
  st,
  at: at(start),
  end: at(end),
  day: "2026-11-21",
  href: `/w/ogs/calendar?week=2026-11-16#day-2026-11-21-${key}`,
});

describe("Home's Today and tomorrow (issue 585 slice 4)", () => {
  it("shows an entry that is over on one line, still a link to its day; one under way or to come keeps two", () => {
    const html = renderToStaticMarkup(
      createElement(HomeNext, {
        items: [
          item("kvk", "KvK", "12:00 ST", "2026-11-21T14:00:00Z", "2026-11-21T16:00:00Z"),
          item("siege", "Undead Siege", "16:00 ST", "2026-11-21T18:00:00Z", "2026-11-21T19:00:00Z"),
          item(
            "meet",
            "Alliance meeting",
            "19:00 ST",
            "2026-11-21T21:00:00Z",
            "2026-11-22T02:00:00Z",
          ),
        ],
        serverZone: "Etc/GMT+2",
        renderedAt: at("2026-11-21T18:30:00Z"), // Sat 16:30 ST
        words: calendarWords(t),
        heads: { today: t["home.today"], tomorrow: t["home.tomorrow"], none: t["home.next.none"] },
      }),
    );
    const [, kvk = "", siege = "", meet = ""] = html.split("<li>");
    expect(kvk).toContain('href="/w/ogs/calendar?week=2026-11-16#day-2026-11-21-kvk"');
    expect(textOf(kvk)).toBe("12:00 ST · KvK · Ended");
    // Under way (started, not over) and still to come: the time line, then the title on a line of its own.
    expect(textOf(siege)).toBe("16:00 ST Undead Siege · Started");
    expect(textOf(meet)).toBe("19:00 ST Alliance meeting");
  });
});
