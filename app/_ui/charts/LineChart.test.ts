import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";

import { LineChart, type ChartPoint } from "./LineChart";

const DAY = 86_400_000;
const T0 = Date.parse("2026-11-09T08:01:00Z");

const render = (points: ChartPoint[], bands: { from: Date; to: Date }[] = []) =>
  renderToStaticMarkup(
    createElement(LineChart, {
      points,
      bands,
      label: "Might",
      value: (n: number) => `${n}M`,
      date: (d: Date) => d.toISOString().slice(5, 10),
      time: (d: Date) => d.toISOString().slice(11, 16),
      copy: en,
    }),
  );
const series = (values: number[], gap = DAY): ChartPoint[] =>
  values.map((value, i) => ({ at: new Date(T0 + i * gap), value }));
/** The y of every vertex of the drawn line. */
const lineYs = (html: string) =>
  [...(/d="([^"]*)" fill="none"/.exec(html)?.[1] ?? "").matchAll(/[ML][\d.]+ ([\d.]+)/g)].map((m) =>
    Number(m[1]),
  );

describe("LineChart (D68)", () => {
  const html = render(series([100, 90, 130], 3.5 * DAY), [
    { from: new Date(T0 + 3 * DAY), to: new Date(T0 + 3.1 * DAY) },
  ]);

  it("draws no SVG <text>: every label is HTML, so next/og's Satori can draw it", () => {
    expect(html).toContain("<svg");
    expect(html).not.toMatch(/<text[\s>]/);
    expect(html).toMatch(/>130M<\/span><span[^>]*>90M</);
  });

  it("names the image by its first and last value", () => {
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Might: 100M on 11-09, 130M on 11-16"');
  });

  it("draws a flat line for a series that hardly moves, and 0 on the bottom edge", () => {
    const near = lineYs(render(series([3_000_000, 3_000_001, 3_000_002])));
    expect(Math.max(...near) - Math.min(...near)).toBeLessThan(1);
    expect(lineYs(render(series([0, 0, 0])))).toEqual([100, 100, 100]);
  });

  it("shows one value label when the highest and lowest round to the same text", () => {
    expect(render(series([0, 0, 0])).match(/>0M</g)).toHaveLength(1);
    expect(render(series([3, 3, 3])).match(/>3M</g)).toHaveLength(1);
  });

  it("gives every reading a dot up to 30 readings, and only event readings above", () => {
    const dots = (page: string) => page.match(/h0/g)?.length;
    expect(dots(render(series(Array.from({ length: 30 }, (_, i) => 100 + i))))).toBe(30);
    const many = series(Array.from({ length: 31 }, (_, i) => 100 + i));
    expect(dots(render(many.map((p, i) => ({ ...p, mark: i % 10 === 0 }))))).toBe(4);
  });

  it("adds the time to the first and last date when they are the same day", () => {
    const same = render(series([100, 110], 3_600_000));
    expect(same).toContain(">11-09, 08:01<");
    expect(same).toContain(">11-09, 09:01<");
  });

  it("marks an event at least 6 px wide, and a wide event as a tick at each end", () => {
    expect(html).toMatch(/width:max\([\d.]+%, 6px\)/);
    const wide = render(series([100, 90], DAY), [{ from: new Date(T0), to: new Date(T0 + DAY) }]);
    expect(wide.match(/bg-ink\/50/g)).toHaveLength(2);
  });
});
