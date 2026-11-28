// Home's first screen (issue 585 slice 4): Follow-up's two numbers in a card of the main column, in Home's
// own words, and no second check-in line in "Members this week"; while the Follow-up tab is off (D126), no
// card and the margin's line as before.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { textOf } from "@/lib/html.test-helpers";
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
  thanks: { donors: [], steady: { help: [], quests: [] }, progress: [], improved: [] },
} as unknown as MembersView;

const card = (followUp: WeekCounts | null) =>
  renderToStaticMarkup(createElement(HomeFollowUp, { slug: "ogs", t, language: "en", followUp }));
const margin = (followUp: WeekCounts | null, members = view) =>
  renderToStaticMarkup(
    createElement(HomeMembers, {
      slug: "ogs",
      t,
      language: "en",
      view: members,
      nudge: false,
      switches: { board: false, writing: false, channel: null },
      followUp,
    }),
  );

describe("Home's Follow-up card (issue 585 slice 4)", () => {
  it("says Follow-up's numbers in the main column while the tab is on, and leaves the margin's line to the tab off", () => {
    const week = card({ toLook: 12, noted: 4 });
    // Two links (drilldown batch C): the head to Follow-up, the noted ones to its "Noted this week".
    expect(textOf(week)).toBe(
      "Follow-up 12 members to look at this week › 4 already noted by officers ›",
    );
    expect(week).toContain('href="/w/ogs/follow-up"');
    expect(week).toContain('href="/w/ogs/follow-up#follow-up-noted"');
    const none = card({ toLook: 1, noted: 0 });
    expect(textOf(none)).toBe("Follow-up 1 member to look at this week ›");
    expect(none).not.toContain("#follow-up-noted");
    expect(textOf(card({ toLook: 0, noted: 4 }))).toBe(
      "Follow-up Nobody to look at this week › 4 already noted by officers ›",
    );
    const fine = card({ toLook: 0, noted: 0 });
    expect(textOf(fine)).toBe("Follow-up Everyone looks fine this week.");
    expect(fine).not.toContain("href");
    expect(followUpWords({ toLook: 1, noted: 1 }, WORKSPACE_DICTIONARIES.fr, "fr")).toEqual({
      head: "1 membre à suivre cette semaine",
      noted: "1 déjà noté par les officiers",
    });
    // The margin says nothing more about check-ins while the card does.
    expect(textOf(margin({ toLook: 0, noted: 0 }))).not.toContain("Everyone looks fine this week.");
    expect(margin({ toLook: 12, noted: 4 })).not.toContain("follow-up");
    // Tab off (D126): no card, nothing read (followUpCounts gives null), and the margin's own line, by
    // Members' rule: "Everyone looks fine", or the count linked to the Members group.
    expect(card(null)).toBe("");
    expect(textOf(margin(null))).toContain("Everyone looks fine this week.");
    const quiet = { reasons: [{ kind: "idle", days: 3 }], officerStatus: null, awayUntil: null };
    const checkIn = margin(null, { ...view, members: [quiet] } as unknown as MembersView);
    expect(checkIn).toContain('href="/w/ogs/members?order=rank#ml-heading"');
    expect(textOf(checkIn)).toContain("1 person to check in with or help");
  });
});

describe("Home's Say thanks to (issue 772)", () => {
  it("lists one line per reason with the names after it, never one run-on sentence", () => {
    const progress = [
      { uid: 1, name: "Bramble", adDone: false, squadGrowth: 0.12 },
      { uid: 2, name: "Thistle", adDone: true, squadGrowth: null },
      { uid: 3, name: "Moss", adDone: false, squadGrowth: 0.08 },
    ];
    const thanks = { donors: [], steady: { help: [], quests: [] }, progress, improved: [] };
    const html = margin(null, { ...view, thanks } as unknown as MembersView);
    // textOf puts a space between elements; the comma follows the name.
    expect(textOf(html).replaceAll(" ,", ",")).toContain(
      "Say thanks to Finished AD Tech: Thistle Grew their main squad: Bramble, Moss",
    );
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(textOf(html)).not.toContain(";");
  });
});
