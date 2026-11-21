import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { coinsTip, historyLine, weekStart } from "./follow-up-rules";

const dayOf = (at: Date) => at.toISOString().slice(0, 10);

describe("the Follow-up rules (issue 340, D104)", () => {
  it("starts the week at Monday 00:00 server time, not UTC", () => {
    // Server time is UTC−2: Mon 16 Nov 01:00Z is Sun 15 Nov 23:00 ST, still the week before.
    const start = weekStart("2026-11-22", "Etc/GMT+2");
    expect(start.toISOString()).toBe("2026-11-16T02:00:00.000Z");
    expect(new Date("2026-11-16T01:00:00Z") < start).toBe(true);
    expect(new Date("2026-11-16T02:00:00Z") >= start).toBe(true);
  });

  it("writes a follow-up as one history line with its note and officer", () => {
    const t = WORKSPACE_DICTIONARIES.en;
    const date = (at: Date) => dayOf(at);
    const day = (iso: string) => iso;
    const at = new Date("2026-11-16T10:00:00Z");
    const talked = { action: "talked", note: "back after exams", until: null, at, by: "Ana" };
    expect(historyLine({ ...talked, action: "talked" }, t, date, day)).toBe(
      "Talked 2026-11-16: back after exams · ⁨Ana⁩",
    );
    const onBreak = {
      ...talked,
      action: "break" as const,
      note: null,
      until: "2026-11-20",
      by: null,
    };
    expect(historyLine(onBreak, t, date, day)).toBe("On a break 2026-11-16 – 2026-11-20");
  });

  it("gives the coins tip on 5 days below 1,000 with data; a day with no read never counts (D140)", () => {
    expect(coinsTip([400, 999, "none", 400, 400, 1000, 1000])).toBe(true);
    expect(coinsTip([400, 400, 400, 400, 1000, 1000, 1000])).toBe(false);
    expect(coinsTip([400, 400, 400, 400, null, null, null])).toBe(false);
  });
});
