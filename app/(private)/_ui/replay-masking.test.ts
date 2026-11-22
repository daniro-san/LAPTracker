// Session replay (issue 549, D142): posthog-js records an element with the class ph-no-capture as an empty
// box. Each member's week of donations and their status line on the Members list, and a member's own daily
// bars on their Me page, sit inside one, so no daily number or bar height reaches a recording. Invented values.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import type { MeView } from "@/lib/private/me";
import { weekCard } from "@/lib/private/me-parts";
import { cardData, cardFormats } from "@/lib/private/member-card";
import { daysFormats } from "@/lib/private/member-card-parts";
import type { ListSource } from "@/lib/private/members";
import { NO_QUERY } from "@/lib/private/members-list";

import { listRow, listWords } from "./member-list-data";
import { MemberCard, type EditorContext } from "./MemberCards";
import { MembersList } from "./MembersList";
import { MeWeek } from "./MeSections";

/** One server day of the member's own reads, as lib/private/me.ts reads it. */
type OwnDay = Parameters<typeof weekCard>[0][number];

const t = WORKSPACE_DICTIONARIES.en;
// Thursday 2026-11-19, 14:00 ST.
const f = cardFormats("en", "Etc/GMT+2", new Date("2026-11-19T16:00:00Z"));

const VOID = new Set(["area", "br", "col", "hr", "img", "input", "meta", "source", "wbr"]);
/** The markup with every ph-no-capture element left out, its children with it: what replay records. */
function recorded(html: string): string {
  let out = "";
  let at = 0;
  let depth = 0; // > 0 inside a ph-no-capture element
  for (const tag of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/g)) {
    if (depth === 0) out += html.slice(at, tag.index);
    at = tag.index + tag[0].length;
    const [whole, close, name = "", self] = tag;
    const opens = !close && !self && !VOID.has(name);
    if (depth > 0) depth += opens ? 1 : close ? -1 : 0;
    else if (opens && /class="[^"]*\bph-no-capture\b/.test(whole)) depth = 1;
    else out += whole;
  }
  return out + html.slice(at);
}

/** One member as the Members list and the card read them. */
const SOURCE: ListSource = {
  uid: 7,
  name: "Thimble",
  rank: "R4 · Muse",
  rankCode: 104,
  might: 61_234_567,
  kills: 2_345_678,
  sanctuary: 29,
  activity: 214,
  noQuestsOn: "2026-11-18",
  noDonationsOn: null,
  honor: 300,
  donations: [5150, 1393, null, "later", "later", "later", "later"],
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
  photo: { hasAvatar: false, frameId: null },
  pastNames: [],
};

describe("session replay on the Members list (issue 549)", () => {
  it("records no member's week of donations or status line, which the page still shows", () => {
    const member = SOURCE;
    const row = listRow(member, t, f);
    const html = renderToStaticMarkup(
      createElement(MembersList, {
        rows: [row],
        words: listWords(t),
        language: "en",
        initialQuery: NO_QUERY,
        initialOrder: null,
        today: "2026-11-19",
        hour: 14,
        serverZone: "Etc/GMT+2",
        early: false,
        sheetHeader: "",
        followUp: null,
        open: null,
        wide: null,
        onOpen: () => {},
      }),
    );
    expect([row.text.donated, row.statusLine]).toEqual(["6.54K", "No daily quests on Wed, Nov 18"]);
    // Shown on the page, in the cards below 640 and in the table from 640 …
    expect(html.split(row.text.donated)).toHaveLength(3);
    expect(html).toContain(row.statusLine);
    // … and in neither when recorded; the name and might are not daily values and stay.
    const kept = recorded(html);
    expect(kept).toContain("Thimble");
    expect(kept).toContain("61.2M");
    expect(kept).not.toContain(row.text.donated);
    expect(kept).not.toContain(row.statusLine);
  });
});

describe("session replay on the member card (issue 634, D137)", () => {
  it("records none of the Raid Shield block, which the card still shows", () => {
    const member = { ...SOURCE, uid: 8, name: "Fennick" };
    const card = {
      ...cardData(member, t, f, { joined: false, lastOnline: false, duel: false }),
      shield: {
        head: "Raid Shield",
        lines: [
          {
            text: "Morning check: no shield seen",
            scan: "map from 07:15 ST",
            tone: "attention" as const,
          },
          { text: "Night check: shield seen", scan: "map from 22:33 ST", tone: "muted" as const },
        ],
      },
    };
    const editor = { slug: "ogs", words: t, language: "en" } as unknown as EditorContext;
    const html = renderToStaticMarkup(
      createElement(MemberCard, {
        card,
        editor,
        zoneNow: null,
        mode: null,
        onEditorClose: () => {},
      }),
    );
    for (const value of ["Raid Shield", "no shield seen", "07:15", "22:33"]) {
      expect(html, value).toContain(value);
    }
    const kept = recorded(html);
    expect(kept).toContain("61.2M");
    for (const value of ["Raid Shield", "shield seen", "07:15", "22:33"]) {
      expect(kept, value).not.toContain(value);
    }
  });
});

describe("session replay on a member's own page (D142)", () => {
  it("records none of their own daily bars or numbers, which the page still shows", () => {
    const day = (d: string, active: number): OwnDay => ({
      day: d,
      listed: true,
      name: "Thimble",
      power: 61_234_567,
      kills: 2_345_678,
      daily: { active, daily_honor: 640, daily_tech: 4321 },
    });
    // Last week's Wednesday, then this week's Monday to Wednesday.
    const days = [day("2026-11-11", 512), day("2026-11-16", 345), day("2026-11-17", 777)];
    const week = weekCard([...days, day("2026-11-18", 401)], "2026-11-19", t, daysFormats(t, f));
    const html = renderToStaticMarkup(
      createElement(MeWeek, { view: { week } as Extract<MeView, { left: false }>, t }),
    );
    for (const value of ["345", "777", "401", "4.32K", "Average 512"]) {
      expect(html, value).toContain(value);
    }
    const kept = recorded(html);
    expect(kept).toContain(t["me.week.head"]);
    expect(kept).not.toContain("height:");
    for (const value of ["345", "777", "401", "4.32K", "640", "512"]) {
      expect(kept, value).not.toContain(value);
    }
  });
});
