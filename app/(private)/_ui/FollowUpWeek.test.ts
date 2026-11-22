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
const week = [
  "2026-11-16",
  "2026-11-17",
  "2026-11-18",
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
];

describe("Follow-up's week around the list (issue 585)", () => {
  it("keeps the Noted card and the Monday rule before the first daily update, so the jump has its card", () => {
    const data = {
      early: true,
      week,
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
        createElement(FollowUpHead, {
          data,
          t,
          language: "en",
          help: { seen: true, covered: false },
        }),
        createElement(FollowUpFoot, { slug: "ogs", data, t, f }),
      ),
    );
    expect(html).toContain('href="#follow-up-noted"');
    expect(html).toContain('id="follow-up-noted"');
    expect(html).toContain("People you note leave the list until Sunday.");
    expect(html).toContain('href="/w/ogs/members?m=7"');
  });

  it("holds the owner's two lines word for word in How this list works, open on the first visit only, the tap cue always in sight", () => {
    const data = { early: false, week, items: [], noted: [], zones: [], thefts: [] };
    const head = (seen: boolean) =>
      renderToStaticMarkup(
        createElement(FollowUpHead, {
          data: data as unknown as FollowUpView,
          t,
          language: "en",
          help: { seen, covered: false },
        }),
      );
    const first = head(false);
    expect(first).toContain("<details open=");
    expect(first).toContain(
      "Say hello, write down what they said, mark how it went. Nothing is sent for you.",
    );
    expect(first).toContain(
      "These are notes for you. Nothing is sent and nobody is removed from the alliance.",
    );
    // Closed after: the summary still says, in sight, that a name opens the panel (one button per row).
    const after = head(true);
    expect(after).not.toContain("<details open=");
    expect(after).toMatch(
      /<summary[^>]*>Tap a name to write down what they said\. <span[^>]*>How this list works<\/span><\/summary>/,
    );
  });
});
