// The officer's member card (issue 549): the Overview's day bars sit inside ph-no-capture, posthog-js's
// block class, so session replay never records a bar height or a daily number. Invented values.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { cardData, cardFormats, type CardExtras } from "@/lib/private/member-card";
import type { MemberRow } from "@/lib/private/members";

import { MemberCard, type EditorContext } from "./MemberCards";

const m: MemberRow = {
  uid: 7,
  name: "Marigold",
  rank: "R3",
  rankCode: 103,
  might: 61_234_567,
  kills: null,
  sanctuary: 29,
  activity: 4321,
  noQuestsOn: null,
  noDonationsOn: null,
  honor: 777,
  donations: [6543, "later", "later", "later", "later", "later", "later"],
  weekTotal: 6543,
  joinedAt: null,
  lastOnlineAt: null,
  mapX: null,
  mapY: null,
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

const DAYS = ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"];

describe("the officer's member card in session replay (issue 549)", () => {
  it("keeps every day bar and daily number inside ph-no-capture", () => {
    const extras = {
      followUps: [],
      previous: {},
      thisWeek: {},
      origin: [],
      history: [],
      days: {
        days: [...DAYS, "2026-11-20"],
        rows: {
          quests: [120, 345, null, "none", 210, 99, 4321],
          coins: [1000, 800, null, 600, 400, 200, 777],
          donations: [5150, null, 4000, 3000, 2000, 1000, 6543],
        },
        might: null,
      },
    } satisfies CardExtras;
    const f = cardFormats("en", "Etc/GMT+2", new Date("2026-11-20T12:00:00Z"));
    const card = cardData(
      m,
      WORKSPACE_DICTIONARIES.en,
      f,
      { joined: false, lastOnline: false, duel: false },
      extras,
    );
    const html = renderToStaticMarkup(
      createElement(MemberCard, {
        card,
        editor: { slug: "ws" } as EditorContext,
        zoneNow: null,
        mode: null,
        onEditorClose: () => {},
      }),
    );
    const [outside, blocked = ""] = html.split('<div class="ph-no-capture">');
    expect(blocked).toContain("height:");
    expect(blocked).toContain(">345<");
    expect(blocked).toContain(">777<");
    expect(outside).not.toContain("height:");
  });
});
