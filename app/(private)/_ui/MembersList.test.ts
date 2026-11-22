// The Members list's first group (issue 585 S3): it sorts the members whose status is Check in or Needs help
// first, by Members' own rule with no week, so it says the Who column's words and no count, and points at
// Follow-up for the week's list while that tab is on (D126: never at a turned-off tab). Invented values.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { cardFormats } from "@/lib/private/member-card";
import type { ListSource } from "@/lib/private/members";
import { NO_QUERY } from "@/lib/private/members-list";

import { listRow, listWords } from "./member-list-data";
import { MembersList } from "./MembersList";

const t = WORKSPACE_DICTIONARIES.en;
const f = cardFormats("en", "Etc/GMT+2", new Date("2026-11-19T12:00:00Z"));
const quiet = {
  uid: 7,
  name: "Thimble",
  rank: "R2",
  rankCode: 102,
  might: 21_000_000,
  kills: 1_000,
  reasons: [{ kind: "idle", days: 3 }],
  missing: [],
  missingDays: 0,
  facts: {},
  officerStatus: null,
  awayUntil: null,
  isNew: false,
  early: false,
  donations: [],
  photo: { hasAvatar: false, frameId: null },
  pastNames: [],
} as unknown as ListSource;

const list = (followUp: string | null) =>
  renderToStaticMarkup(
    createElement(MembersList, {
      rows: [listRow(quiet, t, f)],
      words: listWords(t),
      language: "en",
      initialQuery: NO_QUERY,
      initialOrder: null,
      today: "2026-11-19",
      hour: 14,
      serverZone: "Etc/GMT+2",
      early: false,
      sheetHeader: "",
      followUp,
      open: null,
      wide: null,
      onOpen: () => {},
    }),
  );

describe("the Members list's first group (issue 585 S3)", () => {
  it("says its status words with no count, and points at Follow-up only while that tab is on", () => {
    const on = list("/w/ogs/follow-up");
    expect(on).toContain(">Check in or Needs help</h2>");
    expect(on).toContain("This week’s list:");
    expect(on).toMatch(/<a href="\/w\/ogs\/follow-up"[^>]*>Follow-up ›<\/a>/);
    const off = list(null);
    expect(off).toContain(">Check in or Needs help</h2>");
    expect(off).not.toContain("This week’s list:");
    expect(off).not.toContain("/follow-up");
  });
});
