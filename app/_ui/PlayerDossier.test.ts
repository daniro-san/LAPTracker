import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";
import { textOf } from "@/lib/html.test-helpers";
import type { PlayerHistory, PlayerInAlliance, ProgressReading } from "@/lib/queries";

import { DossierHead } from "./DossierHead";
import { inRange } from "./growth";
import { playerAlliance, playerFacts, playerGrowth } from "./PlayerDossier";

const history = {
  uid: 8,
  current: {
    name: "Nana",
    unionId: 7,
    tag: "OGs",
    badgeId: null,
    eventId: 3,
    hasAvatar: false,
    frameId: null,
    power: 90,
    kills: 4,
    lv: 25,
    updatedAt: null,
    isFresh: true,
    role: null,
  },
  rows: [],
  names: [],
  alliances: [],
} as unknown as PlayerHistory;

const read: PlayerInAlliance = {
  unionId: 7,
  tag: "OGs",
  name: "OldGrandmas",
  badgeId: null,
  day: "2026-11-27",
  at: null,
  server: 325,
  rank: 4,
  role: { kind: "officer", title: "Warlord" },
  active: 580,
};

const reading = (day: string, over: Partial<ProgressReading> = {}): ProgressReading => ({
  at: new Date(`${day}T23:00:00Z`),
  day,
  event: null,
  unionId: 7,
  tag: "OGs",
  name: "Nana",
  power: 100,
  kills: 5,
  rank: 1,
  ...over,
});

const head = (r: PlayerInAlliance | null, newest: ProgressReading | undefined) => {
  const alliance = playerAlliance(r, newest, history);
  const facts = playerFacts({ read: r, alliance, newest, history, copy: en });
  return renderToStaticMarkup(createElement(DossierHead, { picture: null, title: "Nana", facts }));
};

describe("the player page's head", () => {
  it("shows server, might, kills, rank and quest points, with the alliance linked to its page", () => {
    const html = head(read, reading("2026-11-27", { power: 120_000_000, kills: 9_000 }));
    const text = textOf(html);
    expect(html).toContain('href="/alliances/7"');
    for (const part of ["Server", "325", "[OGs] OldGrandmas", "Might", "120M", "Kills", "9.00K"])
      expect(text).toContain(part);
    for (const part of ["Rank", "R4", "Warlord", "Quest points", "580", "Level", "25"])
      expect(text).toContain(part);
  });

  it("leaves out rank and quest points when a newer reading has the player in another alliance", () => {
    const html = head(read, reading("2026-11-28", { unionId: 9 }));
    const text = textOf(html);
    expect(html).toContain('href="/events/3/alliances/7"');
    expect(text).not.toContain("Server");
    expect(text).not.toContain("Quest points");
    expect(text).not.toContain("N/A");
  });
});

describe("playerGrowth", () => {
  it("takes one point per daily read's day and marks event readings; each range keeps its own days", () => {
    const readings = [
      reading("2026-08-01", { power: 1 }),
      reading("2026-11-20", { power: 200 }),
      reading("2026-11-27", { power: 210 }),
      reading("2026-11-27", { power: 220, kills: null }),
      reading("2026-11-28", { day: null, power: 999, event: {} as ProgressReading["event"] }),
    ];
    const [might, kills] = playerGrowth(readings, "en", en);
    expect(might?.points.map((p) => p.value)).toEqual([1, 200, 220]);
    // The event reading is a mark (a hollow dot), not a day of the line.
    expect(might?.marks?.map((m) => m.value)).toEqual([999]);
    expect(kills?.points.map((p) => p.day)).toEqual(["2026-08-01", "2026-11-20"]);
    expect(inRange(might?.points ?? [], 7).map((p) => p.day)).toEqual(["2026-11-20", "2026-11-27"]);
    expect(inRange(might?.points ?? [], 90)).toHaveLength(2);
    expect(inRange(might?.points ?? [], 120)).toHaveLength(3);
  });
});
