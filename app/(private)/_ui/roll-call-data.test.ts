// The Roll call list's cards (issue 298): a Raid prep card names the raid it serves, as its page does (issue
// 585, first glance), not the day the roll call was added.
import { describe, expect, it } from "vitest";

import { zonedInstant } from "@/lib/private/calendar-time";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import type { WeekItem } from "@/lib/private/roll-call-view";

import { rollCard } from "./roll-call-data";

/** The server's clock, UTC−2. */
const ZONE = "Etc/GMT+2";
const ctx = { t: WORKSPACE_DICTIONARIES.en, language: "en" as const, zone: ZONE };

describe("the Roll call list's cards", () => {
  it("dates a Raid prep added on Wednesday by the KvK Saturday it serves", () => {
    // Added by hand on Wednesday, Nov 18, and opened from the list on KvK Saturday, Nov 21.
    const item: WeekItem = {
      key: "id:41",
      occasion: { id: 41 },
      kind: "shield",
      variant: null,
      day: "2026-11-18",
      placed: null,
      callId: 41,
      tally: { yes: 72, no: 20, assumed: 0, notSet: 6, away: 2 },
      team: null,
    };
    const card = rollCard(item, "wrens", "2026-11-21", ctx);
    expect(card).toMatchObject({
      dayLabel: "KvK Sat, Nov 21 · raid at the reset",
      st: "00:00 ST",
      at: zonedInstant("2026-11-21", 0, ZONE),
      day: "2026-11-21",
    });
  });
});
