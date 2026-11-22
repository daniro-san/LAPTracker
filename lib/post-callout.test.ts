// An alliance's own line on our posts (#713, D156), as Discord gets it: whatever an officer types, the line
// renders literally, links nothing (not even a bare domain) and pings no one, keeps no hidden character, and
// counts emoji as one. Invented text only.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CALLOUT_LIMIT,
  calloutLength,
  cleanCallout,
  discordCallout,
  withCallout,
} from "./post-callout";

/**
 * What would ping, link or reshape a Discord message, if it reached Discord as typed: a mention, a web
 * address, a host name (label.tld, an address, with the ideographic dots too), a heading, a line break.
 */
const LIVE =
  /@everyone|@here|<@[!&]?\d|<#\d|<\/\w|https?:\/\/|[\p{L}\p{N}-][.\u3002\uFF0E\uFF61][\p{L}\p{N}]|^(#|-#)\s|\n/iu;
/** A control or format character other than the zero-width joiner. */
const HIDDEN = /(?!\u200D)[\p{Cc}\p{Cf}]/u;

describe("the alliance's own line on our posts (D156)", () => {
  it("reaches Discord literally: no ping, no link, no heading, one line", () => {
    const typed =
      "# Let's go @everyone and @here <@123> <@&456> <#789> </raid:1> https://evil.test evil.example/login discord.gg/abc\nnext";
    const line = discordCallout(typed);
    expect(line).not.toMatch(LIVE);
    // The words stay readable: only zero-width marks and backslashes were added.
    expect(line.replace(/[\u200B\\]/g, "")).toBe(cleanCallout(typed));
    expect(discordCallout("**bold** _it_ ||spoiler||")).toBe(
      "\\*\\*bold\\*\\* \\_it\\_ \\|\\|spoiler\\|\\|",
    );
  });

  it("never lets a ping, a link, a bare domain, a heading or a hidden character through, whatever is typed", () => {
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
      "evil.example/login",
      "1.2.3.4",
      "evil\u3002example",
      "evil\uFF0Eexample",
      "Lv.6",
      ".",
      "# ",
      "-# ",
      "\n",
      "\u200B",
      "\u202E",
      "\u061C",
      "\u180E",
      "\u00AD",
      "\u{E0041}",
      "\u{E007F}",
      " ",
      "x",
    );
    fc.assert(
      fc.property(fc.array(fc.oneof(piece, fc.string()), { maxLength: 12 }), (parts) => {
        const typed = parts.join("");
        expect(discordCallout(typed)).not.toMatch(LIVE);
        expect(cleanCallout(typed)).not.toMatch(HIDDEN);
      }),
    );
  });

  it("is stored as one trimmed line with nothing hidden in it", () => {
    const typed = "  Let's\n\tgo,\u202E fam\u00ADily\u061C\u180E\u{E0041} \u200B ";
    expect(cleanCallout(typed)).toBe("Let's go, family");
    // The zero-width joiner and the variation selector stay: they hold an emoji together.
    expect(cleanCallout("👨\u200D👩\u200D👧 ❤️ Family")).toBe("👨\u200D👩\u200D👧 ❤️ Family");
  });

  it("counts 120 graphemes at most, an emoji with its skin tone as one", () => {
    expect(calloutLength("👍🏽".repeat(CALLOUT_LIMIT))).toBe(CALLOUT_LIMIT);
    expect(calloutLength(`${"a".repeat(CALLOUT_LIMIT)}👍🏽`)).toBe(CALLOUT_LIMIT + 1);
  });

  it("goes above a one-message post, and is left out when the two would pass 2,000 characters", () => {
    expect(withCallout("Let's go, family", "**Raid Shield check**")).toBe(
      "Let's go, family\n**Raid Shield check**",
    );
    expect(withCallout("", "**Raid Shield check**")).toBe("**Raid Shield check**");
    const post = "x".repeat(1900);
    expect(withCallout("y".repeat(99), post)).toBe(`${"y".repeat(99)}\n${post}`);
    expect(withCallout("y".repeat(100), post)).toBe(post);
  });
});
