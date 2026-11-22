import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";
import { textOf } from "@/lib/html.test-helpers";
import type { EventComparison, EventPulse } from "@/lib/queries";
import { fill } from "@/lib/words";

import { ComparePulse } from "./ComparePulse";
import type { Clock } from "./format";

const clock = {
  day: (d: Date) => d.toISOString().slice(0, 10),
  hhmm: () => "12:00",
} as unknown as Clock;
const data = {
  a: { eventAtUtc: new Date("2026-10-17T12:00:00Z") },
  b: { eventAtUtc: new Date("2026-11-21T12:00:00Z") },
} as unknown as EventComparison;
const reasonA = fill(en.ledger.comparePulseOffA, { min: 15, when: "2026-10-17" });
// What the page says only when it draws the strips.
const help = fill(en.ledger.comparePulseHelp, { min: 15, span: 30 });
const sampled = { id: 2, sampled: true, clock: { slots: [{}] } } as unknown as EventPulse;
const html = (a: EventPulse, b: EventPulse) =>
  textOf(
    renderToStaticMarkup(
      createElement(ComparePulse, {
        data,
        pulses: { a, b },
        everyMin: 15,
        details: true,
        clock,
        copy: en,
        locale: "en",
      }),
    ),
  );

describe("ComparePulse (D86)", () => {
  it("is a frame with the reason, and no strip, when event A has no samples", () => {
    const out = html({ id: 1, sampled: false, clock: null }, sampled);
    expect(out).toContain(reasonA);
    expect(out).not.toContain(help);
    expect(out).not.toContain("A · ");
  });

  it("treats a sampled event whose readings give no slots as off", () => {
    const empty = { id: 1, sampled: true, clock: { slots: [] } } as unknown as EventPulse;
    expect(html(empty, sampled)).toContain(reasonA);
  });
});
