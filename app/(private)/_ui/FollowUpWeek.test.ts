// Follow-up's week around the list (issue 585): before the alliance's first daily update a member can still
// be noted (a new member's facts asked), so the head's jump must have its card and the Monday rule must stay
// on the page (D104, amended 2026-11-22). Invented members.
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import type { FollowUpView } from "@/lib/private/follow-up";
import { cardFormats } from "@/lib/private/member-card";
import type { MemberRow } from "@/lib/private/members";

import { FollowUpFoot, FollowUpHead } from "./FollowUpWeek";

const t = WORKSPACE_DICTIONARIES.en;
const f = cardFormats("en", "Etc/GMT+2", new Date("2026-11-18T12:00:00Z")); // Wed 10:00 ST
const wren = { uid: 7, name: "Wren", rank: "R3" } as MemberRow;

describe("Follow-up's week around the list (issue 585)", () => {
  it("keeps the Noted card and the Monday rule before the first daily update, so the jump has its card", () => {
    const data = {
      early: true,
      week: [
        "2026-11-16",
        "2026-11-17",
        "2026-11-18",
        "2026-11-19",
        "2026-11-20",
        "2026-11-21",
        "2026-11-22",
      ],
      items: [],
      noted: [
        {
          member: wren,
          record: {
            uid: 7,
            action: "talked",
            note: null,
            until: null,
            at: new Date("2026-11-17T12:00:00Z"),
            by: "Ana",
          },
        },
      ],
      zones: [],
      thefts: [],
    } as unknown as FollowUpView;
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(FollowUpHead, { data, t, language: "en" }),
        createElement(FollowUpFoot, { slug: "ogs", data, t, f }),
      ),
    );
    expect(html).toContain('href="#follow-up-noted"');
    expect(html).toContain('id="follow-up-noted"');
    expect(html).toContain("People you note leave the list until Sunday.");
    expect(html).toContain('href="/w/ogs/members?m=7"');
  });
});
