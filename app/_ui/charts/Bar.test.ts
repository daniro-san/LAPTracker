import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Bar } from "./Bar";

const render = (props: Partial<ComponentProps<typeof Bar>>) =>
  renderToStaticMarkup(createElement(Bar, { share: 0.5, axis: "y", ...props }));

/** The drawn bar's style: the first aria-hidden box. */
const length = (html: string) =>
  /aria-hidden="true" class="absolute[^"]*" style="([^"]*)"/.exec(html)?.[1];

describe("Bar: one zero rule for every column and row (D158)", () => {
  it("draws nothing for a missing figure, not even an empty track, and still says its words", () => {
    expect(render({ share: null })).toBe("");
    expect(render({ share: null, label: "Tue: —" })).toBe('<span class="sr-only">Tue: —</span>');
  });

  it("draws a zero as a 1 px hairline, never as a stub that reads like a small gain", () => {
    expect(length(render({ share: 0 }))).toBe("height:1px");
    expect(length(render({ share: 0, axis: "x" }))).toBe("width:1px");
  });

  it("draws a loss (a negative share) as the same hairline as a zero", () => {
    expect(length(render({ share: -0.4 }))).toBe("height:1px");
  });

  it("keeps a tiny gain visible with at least 2 px, and otherwise draws its share", () => {
    expect(length(render({ share: 0.001 }))).toBe("height:max(2px, 0.1%)");
    expect(length(render({ share: 0.37 }))).toBe("height:max(2px, 37%)");
  });

  it("clamps a share above its whole to the full track", () => {
    expect(length(render({ share: 1.2 }))).toBe("height:max(2px, 100%)");
  });

  it("draws a reference tick where the threshold sits, from the same end as the bar", () => {
    expect(render({ share: 0.9, reference: 1 / 1.2 })).toMatch(
      /class="absolute bg-ink[^"]*" style="bottom:83.3%"/,
    );
    expect(render({ share: 0.5, axis: "x", reverse: true, reference: 0.25 })).toMatch(
      /style="right:25%"/,
    );
    expect(render({ share: 0.5 })).not.toContain("bg-ink");
  });

  it("puts its words in sr-only text, never in an aria-label", () => {
    const html = render({ share: 0.5, label: "11:00–11:15: 10200 kills" });
    expect(html).toContain('<span class="sr-only">11:00–11:15: 10200 kills</span>');
    expect(html).not.toContain("aria-label");
  });
});
