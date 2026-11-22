// Alliance settings → Features saves on Save (issue 585, F28; D134 amended): ticks only change the draft, Save
// sends one request per switch that differs from what is stored, and a refusal stops it with the rest kept.
import { describe, expect, it } from "vitest";

import { featureChanges, sendChanges, type SwitchPost } from "./settings-save";

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
});
