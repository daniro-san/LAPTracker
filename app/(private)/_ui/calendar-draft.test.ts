// The calendar sheet's draft (issue 300): what an edit sends — only the changed fields, each with the version
// the officer started from — and which day-and-time field a new time goes to.
import { describe, expect, it } from "vitest";

import type { FormValues } from "./calendar-data";
import { changesOf, draftOf } from "./calendar-draft";

/** A weekly Alliance Caravan, planned Monday 16:00 ST; this week's one moved to Tuesday 20:00. */
const moved = (): FormValues => ({
  kind: "caravan",
  variant: null,
  level: null,
  title: "",
  notes: "",
  link: "",
  forMembers: false,
  weekly: true,
  day: "2026-11-24",
  minute: 1200,
  plannedDay: "2026-11-23",
  plannedMinute: 960,
  weekLabel: "Mon, Nov 23",
  versions: { when: 3, slot: 1 },
});

describe("the calendar draft", () => {
  it("sends nothing for an unchanged draft", () => {
    expect(changesOf(draftOf(moved(), ""), moved())).toEqual([]);
  });

  it("moves only this week by default, and with every week sends the plan and puts this week back on it", () => {
    const form = moved();
    const draft = { ...draftOf(form, ""), day: "2026-11-25", time: "18:00" };
    expect(changesOf(draft, form)).toEqual([
      { field: "when", value: { day: "2026-11-25", minute: 1080 }, version: 3 },
    ]);
    expect(changesOf({ ...draft, scope: "all" }, form)).toEqual([
      { field: "slot", value: { weekday: 2, minute: 1080 }, version: 1 },
      { field: "when", value: null, version: 3 },
    ]);
  });
});
