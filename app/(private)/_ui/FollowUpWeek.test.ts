// Follow-up's week around the list (issue 585): before the alliance's first daily update a member can still
// be noted (a new member's facts asked), so the head's jump must have its card and the Monday rule must stay
// on the page (D104, amended 2026-11-22). Invented members.
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { textOf } from "@/lib/html.test-helpers";
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
        createElement(FollowUpHead, { data, t, language: "en" }),
        createElement(FollowUpFoot, { slug: "ogs", data, t, f }),
      ),
    );
    expect(html).toContain('href="#follow-up-noted"');
    expect(html).toContain('id="follow-up-noted"');
    expect(textOf(html)).toContain("People you note leave the list until Sunday.");
    expect(html).toContain('href="/w/ogs/members?m=7"');
  });

  it("keeps How this list works closed on every visit, the owner's line word for word one tap away and the tap cue in sight (issue 585 batch 4 S2)", () => {
    const data = { early: false, week, items: [], noted: [], zones: [], thefts: [] };
    const head = renderToStaticMarkup(
      createElement(FollowUpHead, {
        data: data as unknown as FollowUpView,
        t,
        language: "en",
      }),
    );
    // Open, it pushed "After KvK, offer help" below a phone's first screen on a first visit.
    expect(head).toContain("<details");
    expect(head).not.toMatch(/<details[^>]*\bopen\b/);
    const text = textOf(head);
    expect(text).toContain("Tap a name to write down what they said. How this list works");
    // D104: the owner's words, unchanged; D140's line no longer repeats "Nothing is sent".
    expect(text).toContain(
      "Say hello, write down what they said, mark how it went. These are notes for you. Nothing is sent and nobody is removed from the alliance.",
    );
  });

  it("jumps from the head to After KvK, offer help, counting only its own members, and says nothing without them (issue 585 S5)", () => {
    const on = (kvk: boolean, help: boolean) => ({ member: wren, kvk, help });
    const head = (items: unknown[]) =>
      renderToStaticMarkup(
        createElement(FollowUpHead, {
          data: { early: false, week, items, noted: [], zones: [], thefts: [] } as never,
          t,
          language: "en",
        }),
      );
    // Two in the group; the member also marked Needs help is in that group instead.
    const html = head([on(true, false), on(true, false), on(true, true), on(false, false)]);
    expect(html).toContain('href="#follow-up-kvk"');
    expect(textOf(html)).toContain("2 to offer help after the KvK ↓");
    expect(head([on(true, true), on(false, false)])).not.toContain("#follow-up-kvk");
  });
});
