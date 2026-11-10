import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { en } from "@/lib/copy";

import { makeClock } from "./format";
import { SiteFooter } from "./SiteFooter";

const buildLine = (html: string) => /tabular-nums">([^<]*)<\/p>/.exec(html)?.[1];

describe("SiteFooter", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("writes the build time with the page's clock, like every other date", () => {
    vi.stubEnv("BUILD_LABEL", "v2.0.0 · 88215d2");
    vi.stubEnv("BUILD_AT", "2026-11-08T23:30:00.000Z");
    const clock = makeClock("en", "Etc/GMT+2", { own: false, date: "dd/mm" });
    const html = renderToStaticMarkup(createElement(SiteFooter, { clock, copy: en }));
    expect(buildLine(html)).toBe("v2.0.0 · 88215d2 · 08/11, 21:30 server time");
  });

  it("leaves the build time out where the page has no clock (the client error boundaries)", () => {
    vi.stubEnv("BUILD_LABEL", "dev · 88215d2");
    vi.stubEnv("BUILD_AT", "2026-11-08T23:30:00.000Z");
    const html = renderToStaticMarkup(createElement(SiteFooter, { clock: null, copy: en }));
    expect(buildLine(html)).toBe("dev · 88215d2");
  });
});
