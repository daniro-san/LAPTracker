// Home's and Members' check-in line (issue 585): Follow-up's two numbers, linked to Follow-up, while its
// tab is on; Members' own count of its "Check in and Needs help" group while the tab is off (D126).
// Invented members.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { cardFormats } from "@/lib/private/member-card";
import type { MemberRow, MembersView } from "@/lib/private/members";

import { checkInLink, HomeMembers } from "./HomeMembers";

vi.mock("@/lib/env", () => ({ getEnv: () => ({ SERVER_TZ: "Etc/GMT+2" }) }));

const member = (uid: number, name: string, extra: Partial<MemberRow> = {}): MemberRow => ({
  uid,
  name,
  rank: "R3",
  rankCode: 103,
  might: 41_000_000,
  kills: null,
  sanctuary: 27,
  activity: 300,
  noQuestsOn: null,
  noDonationsOn: null,
  honor: 1000,
  donations: [],
  weekTotal: 0,
  joinedAt: null,
  lastOnlineAt: null,
  mapX: null,
  mapY: null,
  duel: {},
  seenSince: "2026-10-01",
  isNew: false,
  settling: false,
  reasons: [],
  missing: [],
  missingDays: 0,
  facts: {},
  officerStatus: null,
  awayUntil: null,
  early: false,
  ...extra,
});

const quiet = { kind: "idle" as const, days: 3, from: "2026-11-17" };
// Two members Members' group holds (a quiet one, one an officer marked Needs help), one on a break.
const view = {
  members: [
    member(1, "Wren", { reasons: [quiet] }),
    member(2, "Juniper", { officerStatus: "help" }),
    member(3, "Pell", { reasons: [quiet], awayUntil: "2026-11-25" }),
  ],
} as unknown as MembersView;
const t = WORKSPACE_DICTIONARIES.en;
const f = cardFormats("en", "Etc/GMT+2", new Date("2026-11-21T18:30:00Z")); // Sat 16:30 ST

describe("the check-in line on Home and Members (issue 585)", () => {
  it("gives Follow-up's numbers, linked to Follow-up, while its tab is on, and Members' own count while it is off", () => {
    expect(checkInLink("ogs", view, { toLook: 12, done: 4 }, t, f)).toEqual({
      text: "Follow-up: 12 to look at · 4 noted this week",
      href: "/w/ogs/follow-up",
    });
    expect(checkInLink("ogs", view, { toLook: 0, done: 0 }, t, f)).toBeNull();
    // Tab off (D126): no link to a turned-off page.
    expect(checkInLink("ogs", view, null, t, f)).toEqual({
      text: "2 people to check in with or help",
      href: "/w/ogs/members?order=rank#ml-heading",
    });
  });

  it("says nothing about check-ins on Home before the alliance's first daily update", () => {
    const early = {
      ...view,
      early: true,
      thanks: { donors: [], activity: [], progress: [] },
    } as unknown as MembersView;
    const html = renderToStaticMarkup(
      createElement(HomeMembers, {
        slug: "ogs",
        t,
        language: "en",
        view: early,
        nudge: false,
        switches: { board: false, writing: false, channel: null },
        followUp: { toLook: 12, done: 4 },
      }),
    );
    expect(html).toContain(t["home.notYet"]);
    expect(html).not.toContain("Follow-up:");
    expect(html).not.toContain("/w/ogs/follow-up");
  });
});
