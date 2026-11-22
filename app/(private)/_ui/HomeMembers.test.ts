// Home's first screen (issue 585 slice 4): Follow-up's two numbers in a card of the main column, in Home's
// own words, and no second check-in line in "Members this week"; while the Follow-up tab is off (D126), no
// card and the margin's line as before.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import type { WeekCounts } from "@/lib/private/follow-up";
import type { MembersView } from "@/lib/private/members";

import { followUpWords, HomeFollowUp, HomeMembers } from "./HomeMembers";

vi.mock("@/lib/env", () => ({ getEnv: () => ({ SERVER_TZ: "Etc/GMT+2" }) }));

const t = WORKSPACE_DICTIONARIES.en;
// After the first daily update, nobody to thank yet and nobody Members' own rule would name.
const view = {
  members: [],
  early: false,
  reads: [],
  thanks: { donors: [], activity: [], progress: [] },
} as unknown as MembersView;

const card = (followUp: WeekCounts | null) =>
  renderToStaticMarkup(createElement(HomeFollowUp, { slug: "ogs", t, language: "en", followUp }));
const margin = (followUp: WeekCounts | null) =>
  renderToStaticMarkup(
    createElement(HomeMembers, {
      slug: "ogs",
      t,
      language: "en",
      view,
      nudge: false,
      switches: { board: false, writing: false, channel: null },
      followUp,
    }),
  );

describe("Home's Follow-up card (issue 585 slice 4)", () => {
  it("says Follow-up's numbers in the main column while the tab is on, and leaves the margin's line to the tab off", () => {
    const week = card({ toLook: 12, noted: 4 });
    expect(week).toContain(">Follow-up</h2>");
    expect(week).toContain('href="/w/ogs/follow-up"');
    expect(week).toContain(">12 members to look at this week · 4 already noted by officers</a>");
    expect(card({ toLook: 1, noted: 0 })).toContain(">1 member to look at this week</a>");
    expect(card({ toLook: 0, noted: 4 })).toContain(
      ">Nobody to look at this week · 4 already noted by officers</a>",
    );
    const fine = card({ toLook: 0, noted: 0 });
    expect(fine).toContain("Everyone looks fine this week.");
    expect(fine).not.toContain("href");
    expect(followUpWords({ toLook: 1, noted: 1 }, WORKSPACE_DICTIONARIES.fr, "fr")).toBe(
      "1 membre à suivre cette semaine · 1 déjà noté par les officiers",
    );
    // The margin says nothing more about check-ins while the card does.
    expect(margin({ toLook: 0, noted: 0 })).not.toContain("Everyone looks fine this week.");
    expect(margin({ toLook: 12, noted: 4 })).not.toContain("follow-up");
    // Tab off (D126): no card, nothing read (followUpCounts gives null), and the margin's own line.
    expect(card(null)).toBe("");
    expect(margin(null)).toContain("Everyone looks fine this week.");
  });
});
