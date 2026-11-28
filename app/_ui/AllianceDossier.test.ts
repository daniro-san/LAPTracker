import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";
import { textOf } from "@/lib/html.test-helpers";
import type { AlliancePage } from "@/lib/queries";

import { AllianceMembers, allianceFacts } from "./AllianceDossier";
import { DossierHead } from "./DossierHead";
import type { Clock } from "./format";

const clock = { day: () => "Nov 27" } as unknown as Clock;
const page: AlliancePage = {
  unionId: 7,
  tag: "OGs",
  name: "OldGrandmas",
  badgeId: null,
  day: "2026-11-27",
  at: null,
  server: 325,
  might: 3_940_000_000,
  members: 97,
  capacity: 100,
  leader: { uid: 3, name: "Lady", power: 120_000_000 },
  roster: [
    {
      uid: 3,
      name: "Lady",
      rank: 5,
      role: { kind: "leader" },
      power: 120_000_000,
      active: 580,
      dailyHonor: 1000,
      dailyTech: null,
    },
  ],
  growth: [],
};
const board = {
  unionId: 7,
  tag: "OGs",
  name: "OldGrandmas",
  badgeId: null,
  power: 1,
  powerRank: 2,
  kills: null,
  killsRank: null,
  day: "2026-11-27",
};

const head = (p: AlliancePage | null, b: typeof board | null) =>
  textOf(
    renderToStaticMarkup(
      createElement(DossierHead, {
        picture: null,
        title: "[OGs] OldGrandmas",
        facts: allianceFacts(p, b, clock, "en", en),
      }),
    ),
  );

describe("the alliance page's head", () => {
  it("shows server, leader with might, might, members of capacity and server rank", () => {
    const text = head(page, board);
    for (const part of ["Server", "325", "Leader", "Lady", "Might 120M", "97/100", "#2"])
      expect(text).toContain(part);
    expect(text).toContain("Ranks board of Nov 27");
  });

  it("leaves out a fact it does not know, never N/A", () => {
    const text = head({ ...page, server: null, leader: null }, null);
    expect(text).not.toContain("Server");
    expect(text).not.toContain("Leader");
    expect(text).not.toContain("N/A");
  });
});

describe("AllianceMembers", () => {
  it("shows a member's known figures as chips and leaves out the unknown one", () => {
    const html = renderToStaticMarkup(createElement(AllianceMembers, { page, clock, copy: en }));
    const text = textOf(html);
    expect(html).toContain('href="/players/3"');
    expect(text).toContain("Quest points");
    expect(text).toContain("Help coins");
    expect(text).not.toContain("Tech donated");
  });
});
