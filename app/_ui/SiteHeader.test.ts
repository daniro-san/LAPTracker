import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { en } from "@/lib/copy";

import type { Clock } from "./format";
import { SiteHeader } from "./SiteHeader";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const clock = { weekday: () => "Sat, Nov 7", day: () => "Nov 7" } as unknown as Clock;
const at = new Date("2026-11-07T14:00:00Z");

describe("SiteHeader", () => {
  it("marks the home event latest and links it to /, and links a newer upcoming event to its own page", () => {
    const html = renderToStaticMarkup(
      createElement(SiteHeader, {
        events: [
          { id: 3, name: "Saturday Event 2026-11-07", manual: false, eventAtUtc: at },
          { id: 2, name: "Manual round 2026-11-05", manual: true, eventAtUtc: at },
        ],
        currentId: 2,
        homeId: 2,
        clock,
        copy: en,
      }),
    );
    const links = [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)]
      .filter(([, href]) => href === "/" || href?.startsWith("/events/"))
      .map(([, href, body]) => [href, body?.includes(en.site.latest)]);
    // The first "/" is the logo.
    expect(links).toEqual([
      ["/", false],
      ["/events/3", false],
      ["/", true],
    ]);
  });
});
