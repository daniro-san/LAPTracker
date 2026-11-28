// Alliance settings → Raid Shield check (issue 859): the card shows the tracker calls the chosen reads cost,
// one per member a read, the after-reset check's only while it is on.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { RaidPrepSettings } from "./RaidPrepSettings";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const view = {
  nightMinute: 1410,
  morningMinute: 600,
  resetRead: true,
  resetMinute: 150,
  discord: false,
  language: "en" as const,
  members: 97,
};

const card = (resetRead: boolean) =>
  renderToStaticMarkup(
    createElement(RaidPrepSettings, {
      slug: "ogs",
      view: { ...view, resetRead },
      choices: { night: [1410, 1425], morning: [600, 615], reset: [150, 165] },
      channel: "none",
      t: WORKSPACE_DICTIONARIES.en,
      language: "en",
    }),
  );

describe("the Raid Shield check's settings card", () => {
  it("shows the tracker calls of three reads, or two with the after-reset check off", () => {
    expect(card(true)).toContain("About 291 tracker calls from Friday night to Saturday morning");
    expect(card(false)).toContain("About 194 tracker calls from Friday night to Saturday morning");
  });
});
