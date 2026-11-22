// The member card's words (issue 461, D136): map position is kept out of the details the Info tab shows,
// behind "Show map position". Invented values.
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { cardData, cardFormats } from "./member-card";
import { versionLines } from "./member-card-parts";
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
  settling: false,
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

describe("the member card's earlier values (D136)", () => {
  it("lists every earlier value of each fact, newest first, and leaves out the current one", () => {
    const f = cardFormats("en", "Etc/GMT+2", new Date("2026-11-20T12:00:00Z"));
    const row = (field: string, version: number, value: unknown, at: string) => ({
      uid: 7,
      field,
      version,
      value,
      source: "officer" as const,
      writtenAt: new Date(at),
    });
    const history = [
      row("squadMight", 1, 18_100_000, "2026-11-10T14:00:00Z"),
      row("timeZone", 1, "Europe/Paris", "2026-11-12T14:00:00Z"),
      row("squadMight", 2, 19_400_000, "2026-11-16T14:00:00Z"),
      row("timeZone", 2, "Europe/Lisbon", "2026-11-17T14:00:00Z"),
      row("squadMight", 3, 20_000_000, "2026-11-18T14:00:00Z"),
    ];
    expect(versionLines(history, WORKSPACE_DICTIONARIES.en, f)).toEqual([
      "Main squad might: 19.4M · Mon, Nov 16",
      "Time zone: Europe/Paris · UTC+1 · Thu, Nov 12",
      "Main squad might: 18.1M · Tue, Nov 10",
    ]);
  });
});
