// An alliance's own line on our posts (#713, D156), as Discord gets it: whatever an officer types, the line
// renders literally, links nothing and pings no one, and counts emoji as one. Invented text only.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CALLOUT_LIMIT,
  calloutLength,
  cleanCallout,
  discordCallout,
  withCallout,
} from "./post-callout";

/** What would ping, link or reshape a Discord message, if it reached Discord as typed. */
const LIVE =
  /@everyone|@here|<@[!&]?\d|<#\d|<\/\w|https?:\/\/|discord(app)?\.(gg|com\/invite)|^(#|-#)\s|\n/i;

describe("the alliance's own line on our posts (D156)", () => {
  it("reaches Discord literally: no ping, no link, no heading, one line", () => {
    const typed =
      "# Let's go @everyone and @here <@123> <@&456> <#789> </raid:1> https://evil.test discord.gg/abc\nnext";
    const line = discordCallout(typed);
    expect(line).not.toMatch(LIVE);
    // The words stay readable: only zero-width marks and backslashes were added.
    expect(line.replace(/[\u200b\\]/g, "")).toBe(cleanCallout(typed));
    expect(discordCallout("**bold** _it_ ||spoiler||")).toBe(
      "\\*\\*bold\\*\\* \\_it\\_ \\|\\|spoiler\\|\\|",
    );
  });

  it("never lets a ping, a link or a heading through, whatever is typed", () => {
    const piece = fc.constantFrom(
      "@everyone",
      "@here",
      "<@1>",
      "<@&2>",
      "<@!3>",
      "<#4>",
      "</cmd:5>",
      "https://",
      "http://",
      "discord.gg/",
      "discordapp.com/invite/",
      "# ",
      "-# ",
      "\n",
      "\u200b",
      " ",
      "x",
    );
    fc.assert(
      fc.property(fc.array(fc.oneof(piece, fc.string()), { maxLength: 12 }), (parts) => {
        expect(discordCallout(parts.join(""))).not.toMatch(LIVE);
      }),
    );
  });

  it("is stored as one trimmed line with nothing hidden in it", () => {
    expect(cleanCallout("  Let's\n\tgo,\u202e family \u200b ")).toBe("Let's go, family");
    // The zero-width joiner stays: it holds a family emoji together.
    expect(cleanCallout("👨‍👩‍👧 Family")).toBe("👨‍👩‍👧 Family");
  });

  it("counts 120 graphemes at most, an emoji with its skin tone as one", () => {
    expect(calloutLength("👍🏽".repeat(CALLOUT_LIMIT))).toBe(CALLOUT_LIMIT);
    expect(calloutLength(`${"a".repeat(CALLOUT_LIMIT)}👍🏽`)).toBe(CALLOUT_LIMIT + 1);
  });

  it("goes above the post's first line, and leaves the post as it was without one", () => {
    expect(withCallout("Let's go, family", "**Raid Shield check**")).toBe(
      "Let's go, family\n**Raid Shield check**",
    );
    expect(withCallout("", "**Raid Shield check**")).toBe("**Raid Shield check**");
    expect(withCallout(" \n ", "**Raid Shield check**")).toBe("**Raid Shield check**");
  });
});
