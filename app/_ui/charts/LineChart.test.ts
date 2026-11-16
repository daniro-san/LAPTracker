import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";

import { LineChart } from "./LineChart";

const html = renderToStaticMarkup(
  createElement(LineChart, {
    points: [
      { at: new Date("2026-11-09T08:01:00Z"), value: 100 },
      { at: new Date("2026-11-12T08:01:00Z"), value: 90 },
      { at: new Date("2026-11-16T08:01:00Z"), value: 130 },
    ],
    bands: [{ from: new Date("2026-11-12T08:01:00Z"), to: new Date("2026-11-13T08:01:00Z") }],
    label: "Might",
    value: (n) => `${n}M`,
    date: (d) => d.toISOString().slice(5, 10),
    copy: en,
  }),
);

describe("LineChart (D68)", () => {
  it("draws no SVG <text>: every label is HTML, so next/og's Satori can draw it", () => {
    expect(html).toContain("<svg");
    expect(html).not.toMatch(/<text[\s>]/);
    expect(html).toMatch(/<span[^>]*>130M<\/span><span[^>]*>90M<\/span>/);
  });

  it("names the image by its first and last value", () => {
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Might: 100M on 11-09, 130M on 11-16"');
  });
});
