import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";
import type { PlayerProgress } from "@/lib/queries";

import type { Clock } from "./format";
import { summaryText } from "./PlayerProgress";

const progress = {
  readings: [],
  summary: {
    from: { power: 100 },
    power: 4,
    alliance: { tag: "OGs", medianPercent: 4.1 },
  },
} as unknown as PlayerProgress;
const clock = (day: string) => ({ day: () => day }) as unknown as Clock;

describe("summaryText", () => {
  it("states the player's change and the middle member's, in percent", () => {
    expect(summaryText(progress, clock("Oct 24"), "en", en)).toBe(
      "You: +4.0% since Oct 24. Middle member of [OGs]: +4.1%.",
    );
  });

  it("states only the player's change when there is no alliance median or no tag to name it by", () => {
    for (const alliance of [null, { tag: null, medianPercent: 4.1 }]) {
      const p = { ...progress, summary: { ...progress.summary, alliance } } as PlayerProgress;
      expect(summaryText(p, clock("Oct 24"), "en", en)).toBe("You: +4.0% since Oct 24.");
    }
  });

  it("states the change as an amount when the older might is 0", () => {
    const p = {
      ...progress,
      summary: { ...progress.summary, from: { power: 0 }, power: 4_000_000, alliance: null },
    } as unknown as PlayerProgress;
    expect(summaryText(p, clock("Oct 24"), "en", en)).toBe("You: +4.00M since Oct 24.");
  });

  it("does not double the full stop when the date ends with one", () => {
    const copy = { ...en, ledger: { ...en.ledger, progressMight: "Du: {change} seit {date}." } };
    expect(summaryText(progress, clock("24. Okt."), "en", copy)).toMatch(
      /^Du: \+4\.0% seit 24\. Okt\. Middle member/,
    );
  });
});
