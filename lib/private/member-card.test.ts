// The member card's words (issue 461, D136): map position is kept out of the details the Info tab shows,
// behind "Show map position". Invented values.
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { cardData, cardFormats } from "./member-card";
import type { MemberRow } from "./members";

const m: MemberRow = {
  uid: 7,
  name: "Marigold",
  rank: "R3",
  rankCode: 103,
  might: 61_234_567,
  kills: null,
  sanctuary: 29,
  activity: 214,
  noQuestsOn: null,
  noDonationsOn: null,
  honor: 300,
  donations: [5150, null, 4000, "later", "later", "later", "later"],
  weekTotal: 9150,
  joinedAt: null,
  lastOnlineAt: null,
  mapX: 4321,
  mapY: 8765,
  duel: {},
  seenSince: "2026-11-02",
  isNew: false,
  reasons: [],
  missing: [],
  missingDays: 0,
  facts: {},
  officerStatus: null,
  awayUntil: null,
  early: false,
};

describe("the member card's map position (D136)", () => {
  it("leaves it out of the shown details and keeps it behind Show map position", () => {
    const f = cardFormats("en", "Etc/GMT+2", new Date("2026-11-20T12:00:00Z"));
    const shown = { joined: false, lastOnline: false, duel: false };
    const card = cardData(m, WORKSPACE_DICTIONARIES.en, f, shown);
    expect(card.details.map((d) => d.label)).toEqual(["Seen since"]);
    expect(card.map).toEqual({
      label: "Map position",
      value: "X 4321 · Y 8765",
      show: "Show map position",
    });
  });
});
