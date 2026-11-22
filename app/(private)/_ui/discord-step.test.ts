// Alliance settings → Discord says one thing about the bot (issue 585, F28): with the site's bot off, the card
// never repeats an old "LAPTracker is in your server" under "the bot is not set up on this site".
import { describe, expect, it } from "vitest";

import { botLines, type BotFacts } from "./discord-step";

/** An alliance whose bot was found five days ago, with two commands registered. */
const checked: BotFacts = {
  installUrl: "https://discord.example.invalid/oauth2/authorize?client_id=1",
  ready: true,
  seen: true,
  commands: ["translate", "me"],
  wanted: ["translate", "me"],
};

describe("the Discord card's bot steps", () => {
  it("shows one off block and no step numbers when the site's bot is off", () => {
    const lines = botLines({ ...checked, installUrl: null, ready: false });
    expect(lines.step).toBe("off");
    expect(lines.keys).toEqual(["discord.bot.siteOffHead", "discord.bot.siteOff"]);
    expect(lines.hooksHead).toBe("discord.hooks.headAlone");
    for (const never of [
      "discord.check.seen",
      "discord.check.commands",
      "discord.check.never",
      "discord.check.lead",
      "discord.check.off",
      "discord.bot.unset",
    ])
      expect(lines.keys, never).not.toContain(never);

    // With the bot ready, the three numbered steps and the stored state are back.
    const on = botLines(checked);
    expect(on.step).toBe("ready");
    expect(on.keys).toContain("discord.check.seen");
    expect(on.hooksHead).toBe("discord.hooks.head");
  });

  it("says only that Check is off when the site has the app id but cannot check", () => {
    const lines = botLines({ ...checked, ready: false });
    expect(lines.step).toBe("noCheck");
    expect(lines.keys).toContain("discord.check.off");
    expect(lines.keys).not.toContain("discord.check.seen");
    expect(lines.keys).not.toContain("discord.check.commands");
    expect(lines.keys).not.toContain("discord.check.lead");
    expect(lines.hooksHead).toBe("discord.hooks.head");
  });
});
