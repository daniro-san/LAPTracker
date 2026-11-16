import { describe, expect, it } from "vitest";

import type { MemberRow } from "./members";
import { filtersOf } from "./members-list";

const row = (rankCode: number | null): MemberRow => ({
  uid: 1,
  name: "P1",
  rank: null,
  rankCode,
  might: 1000,
  sanctuary: 25,
  activity: 10,
  honor: 0,
  donations: [],
  weekTotal: null,
  joinedAt: null,
  lastOnlineAt: null,
  mapX: 0,
  mapY: 0,
  seenSince: null,
  isNew: false,
  reasons: [],
  missing: [],
  missingDays: 0,
  facts: {},
  officerStatus: null,
  awayUntil: null,
  early: false,
});

describe("the R4 and R5 filter", () => {
  it("keeps R4 and R5, and neither R3 nor a member without a rank", () => {
    expect([105, 104, 103, null].map((code) => filtersOf(row(code)).includes("r4"))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});
