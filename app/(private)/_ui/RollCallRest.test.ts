// The roll call's sticky bar (D103, issue 585): on Raid prep it counts in the page's own words, "to mark",
// the words the Shield card above uses; "not set" was read as "no shield" (first glance).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { markWords, rollWords } from "./roll-call-data";
import { RestBar } from "./RollCallRest";

const t = WORKSPACE_DICTIONARIES.en;
const idle = {
  text: null,
  fresh: false,
  busy: false,
  undoable: false,
  rest: async () => {},
  undo: async () => {},
};

describe("the roll call's sticky bar", () => {
  it("counts Raid prep's Shield marks still to mark in the card's words", () => {
    // KvK Saturday after the morning check: 6 with no Shield mark, 1 of them not seen by the tracker yet, and
    // 2 away; "Mark ✓ the n seen with a shield" covers the rest, so the bar offers no button.
    const html = renderToStaticMarkup(
      createElement(RestBar, {
        left: 6,
        rest: 5,
        part: t["roll.prep.shield"],
        away: 2,
        offer: false,
        words: rollWords(t),
        language: "en",
        marks: markWords("shield", t),
        r: idle,
        onRest: () => {},
      }),
    );
    expect(html).toContain("Shield: 6 to mark · 2 away, left out · 1 not seen yet, left out");
    expect(html).not.toContain("not set");
  });
});
