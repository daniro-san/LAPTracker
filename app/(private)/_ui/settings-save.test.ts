// Alliance settings → Features saves on Save (issue 585, F28; D134 amended): ticks only change the draft, Save
// sends one request per switch that differs from what is stored, and a refusal stops it with the rest kept.
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import {
  afterSave,
  featureChanges,
  refusalWords,
  sendChanges,
  shownOn,
  type SwitchPost,
} from "./settings-save";

/** What the server stores for an alliance with every tab on and squads off. */
const stored = { roll_call: true, thefts: true, insights: true, notices: true, squads: false };

describe("Features in Alliance settings", () => {
  it("counts only what the officer changed, and a box ticked back is no change", () => {
    expect(featureChanges(stored, stored)).toEqual([]);
    // Thefts off, Insights off and on again, Squads on.
    const draft = { ...stored, thefts: false, insights: true, squads: true };
    expect(featureChanges(stored, draft)).toEqual([
      { feature: "thefts", on: false },
      { feature: "squads", on: true },
    ]);
  });

  it("sends one request per change, one after another, when the officer taps Save", async () => {
    const sent: string[] = [];
    let open = 0;
    const post: SwitchPost = async ({ feature, on }) => {
      open += 1;
      expect(open).toBe(1); // never two at once
      sent.push(`${feature}:${on}`);
      await Promise.resolve();
      open -= 1;
      return { saved: on, code: null };
    };
    const changes = featureChanges(stored, { ...stored, thefts: false, squads: true });
    expect(await sendChanges(changes, post)).toEqual({ code: null, unsent: [] });
    expect(sent).toEqual(["thefts:false", "squads:true"]);
  });

  it("stops at the first refusal and keeps the switches not sent as the draft", async () => {
    const sent: string[] = [];
    const refuseSquads: SwitchPost = async ({ feature, on }) => {
      sent.push(feature);
      return feature === "insights"
        ? { saved: null, code: "rate_limited" }
        : { saved: on, code: null };
    };
    const changes = featureChanges(stored, {
      ...stored,
      thefts: false,
      insights: false,
      squads: true,
    });
    expect(await sendChanges(changes, refuseSquads)).toEqual({
      code: "rate_limited",
      unsent: [
        { feature: "insights", on: false },
        { feature: "squads", on: true },
      ],
    });
    expect(sent).toEqual(["thefts", "insights"]);

    // No answer at all reads as "failed", and nothing after it is sent.
    const offline: SwitchPost = async () => ({ saved: null, code: "failed" });
    expect((await sendChanges(changes, offline)).unsent).toHaveLength(3);
  });

  it("names the switch the owner turned off meanwhile, drops it and keeps the rest as the draft", async () => {
    // The officer saves Thefts off, Insights off and Squads on; the owner stopped allowing Insights meanwhile.
    const changes = featureChanges(stored, {
      ...stored,
      thefts: false,
      insights: false,
      squads: true,
    });
    const ownerOff: SwitchPost = async ({ feature, on }) =>
      feature === "insights" ? { saved: null, code: "not_allowed" } : { saved: on, code: null };
    const result = await sendChanges(changes, ownerOff);
    expect(result.code).toBe("not_allowed");
    for (const language of ["en", "pt-BR", "fr"] as const) {
      const t = WORKSPACE_DICTIONARIES[language];
      const words = refusalWords("not_allowed", result.unsent[0], t);
      expect(words, language).toContain(t["switches.name.insights"]);
      expect(words, language).not.toBe(t["switches.failed"]);
    }
    expect(afterSave(changes, result, {}).draft).toEqual({ squads: true });
  });

  it("shows what a Save stored until the page refreshes, and keeps what was not sent as the draft", () => {
    // A first Save stored Notices off; this one stored Thefts off, then the limit stopped Squads on.
    const changes = [
      { feature: "thefts", on: false },
      { feature: "squads", on: true },
    ];
    const next = afterSave(
      changes,
      { code: "rate_limited", unsent: [{ feature: "squads", on: true }] },
      { notices: false },
    );
    expect(next).toEqual({ through: { notices: false, thefts: false }, draft: { squads: true } });
    // The box shows the draft first, then what was stored, then what the page read.
    expect(shownOn("squads", false, next.draft, next.through)).toBe(true);
    expect(shownOn("thefts", true, next.draft, next.through)).toBe(false);
    expect(shownOn("roll_call", true, next.draft, next.through)).toBe(true);
    expect(shownOn("thefts", true, { thefts: true }, next.through)).toBe(true);
  });
});
