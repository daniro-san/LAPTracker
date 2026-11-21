// Raid prep's ready message (D137): a Shield mark of ✓ or "no problem seen" (old Raid Shield roll calls'
// "the rest" too) asks nothing about the shield; only the parts not yet done are asked.
import { describe, expect, it } from "vitest";

import { PREP_MESSAGE } from "@/lib/private/dictionary.raidprep";

import { prepMessage, remindAll, remindNames, shieldDone, toRemind } from "./prep-message";

const en = PREP_MESSAGE.en;
const msg = (shield: Parameters<typeof shieldDone>[0], wall: boolean, seen = false) =>
  prepMessage(en, "Wren", "reset", { shield: shieldDone(shield), wall, seen });

describe("Raid prep's message (D137)", () => {
  it("leaves the shield out when it is ✓ or no problem seen, and asks the rest", () => {
    expect(msg("assumed", false)).toBe(
      "Hi Wren, before the reset, please take your squads off the wall and bring your troops home. Thanks!",
    );
    expect(msg("yes", true)).toBe(
      "Hi Wren, before the reset, please bring your troops home. Thanks!",
    );
    expect(msg(null, false)).toBe(
      "Hi Wren, before the reset, please turn on your shield, take your squads off the wall and bring your troops home. Thanks!",
    );
    expect(msg("no", true, true)).toBe(
      "Hi Wren, before the reset, please check your shield is still on and bring your troops home. Thanks!",
    );
  });
});

describe("Raid prep's reminder list and one message (issue 585)", () => {
  it("lists ✗ and the not set the tracker did not see, never one it saw with a shield", () => {
    const rows = ["Aster", "Briar", "Corin", "Dell"].map((name, i) => ({ uid: i + 1, name }));
    const marks: Record<number, "yes" | "no" | null> = { 1: "no", 2: null, 3: null, 4: "yes" };
    const seen = (uid: number) => uid === 3;
    expect(toRemind(rows, (uid) => marks[uid] ?? null, seen)).toEqual(["Aster", "Briar"]);
  });

  it("names everyone first in one message to many, typed names escaped so nobody is pinged", () => {
    expect(remindAll(en, ["Aster", "@everyone", "*Briar*"], "reset")).toBe(
      "Aster, @\u200beveryone, \\*Briar\\*: before the reset, please make sure your shield is on, take your squads off the wall and bring your troops home. Thanks!",
    );
    // A mention, and the `>` Discord reads as a quote, both escaped.
    expect(remindNames(["<@123>", "Corin"])).toBe("<@\u200b123\\>, Corin");
  });
});
