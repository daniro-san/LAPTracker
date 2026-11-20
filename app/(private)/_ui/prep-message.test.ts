// Raid prep's ready message (D137): a Shield mark of ✓ or "no problem seen" (old Raid Shield roll calls'
// "the rest" too) asks nothing about the shield; only the parts not yet done are asked.
import { describe, expect, it } from "vitest";

import { PREP_MESSAGE } from "@/lib/private/dictionary.raidprep";

import { prepMessage, shieldDone } from "./prep-message";

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
