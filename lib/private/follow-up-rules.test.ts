import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { historyLine, resolvedIn } from "./follow-up-rules";

const dayOf = (at: Date) => at.toISOString().slice(0, 10);

describe("the Follow-up rules (issue 340, D104)", () => {
  it("resolves a member only for the game week the record was made in", () => {
    const rows = [
      { uid: 1, at: new Date("2026-11-16T08:00:00Z") }, // Monday of this week
      { uid: 2, at: new Date("2026-11-15T20:00:00Z") }, // Sunday of last week: back on the list
    ];
    expect([...resolvedIn(rows, "2026-11-22", dayOf)]).toEqual([1]);
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
});
