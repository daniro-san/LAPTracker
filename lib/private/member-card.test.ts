// The member card's words (issue 461, D136): map position is kept out of the details the Info tab shows,
// behind "Show map position". Invented values.
import { describe, expect, it } from "vitest";

import { calendarDates } from "./calendar-words";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import { duelHistory } from "./duel-history";
import { cardData, cardFormats } from "./member-card";
import { duelCard, versionLines } from "./member-card-parts";
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
    const shown = { duel: false };
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

describe("the member card's presence lines (issue 821)", () => {
  const f = cardFormats("en", "Etc/GMT+2", new Date("2026-11-20T12:00:00Z"));
  const shown = { duel: false };

  it("shows the last seen and the joined dates", () => {
    const row = {
      ...m,
      lastOnlineAt: new Date("2026-11-18T10:00:00Z"),
      joinedAt: new Date("2026-09-02T10:00:00Z"),
    };
    expect(cardData(row, WORKSPACE_DICTIONARIES.en, f, shown).presence).toEqual([
      "Last seen in game: Wed, Nov 18",
      "In the alliance since: Wed, Sep 2",
    ]);
  });

  it("shows each fact once: the Details tab does not repeat them", () => {
    const row = {
      ...m,
      lastOnlineAt: new Date("2026-11-18T10:00:00Z"),
      joinedAt: new Date("2026-09-02T10:00:00Z"),
    };
    expect(cardData(row, WORKSPACE_DICTIONARIES.en, f, shown).details.map((d) => d.label)).toEqual([
      "Seen since",
    ]);
  });

  it("says no data with no reading", () => {
    expect(cardData(m, WORKSPACE_DICTIONARIES.en, f, shown).presence).toEqual([
      "Last seen in game: no data",
      "In the alliance since: no data",
    ]);
  });
});

describe("the member card's Alliance Duel by week (issue 467, D158)", () => {
  const f = cardFormats("en", "Etc/GMT+2", new Date("2026-11-23T12:00:00Z"));
  const row = (uid: number, week: string, points: number) => ({ uid, week, points });

  it("leaves a no-data week without a value or a bar, draws a real 0 as a hairline, and says so far", () => {
    const rows = [
      row(1, "2026-11-02", 4_000_000),
      row(1, "2026-11-16", 0),
      row(2, "2026-11-02", 8_000_000),
      row(1, "2026-11-23", 2_000_000),
    ];
    const h = duelHistory(rows, new Set([1, 2]), 1, "2026-11-23");
    if (!h) throw new Error("no history");
    const card = duelCard(h, WORKSPACE_DICTIONARIES.en, f);
    const at = (week: string) =>
      card.rows.find((r) => r.label.startsWith(calendarDates("en").dayMonth(week)));
    // 2026-11-09 has no picture: no value, no share, never 0.
    expect(at("2026-11-09")).toMatchObject({ value: null, share: null });
    // Bars are drawn against the alliance's best member-week (8M), and a real 0 has a share of 0.
    expect(at("2026-11-02")?.share).toBe(0.5);
    expect(at("2026-11-16")).toMatchObject({ value: "0", share: 0 });
    expect(card.rows.at(-1)?.label).toBe(`${calendarDates("en").dayMonth("2026-11-23")} · so far`);
    // The running week (2M) is in no average: the member has 4M and 0 in the finished weeks.
    expect(card.average).toBe("Average 2.00M a week · 2 finished weeks");
    expect(card.alliance).toBe("Alliance total, average 6.00M a week · 2 finished weeks");
  });
});
