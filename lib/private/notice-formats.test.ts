// A notice's copy formats (issue 345, D102): the game's notice board cuts after the last whole line that
// fits, the game's mail keeps everything, Discord shows the officer's text literally, and a long post is
// split into messages Discord takes.
import { describe, expect, it } from "vitest";

import {
  DISCORD_LIMIT,
  discordMessages,
  discordPost,
  gameMail,
  gameNotice,
} from "./notice-formats";

describe("notice formats", () => {
  it("cuts the game notice after the last whole line within 1000 characters; the mail keeps it all", () => {
    const text = `Line one  \r\n${"x".repeat(995)}\r\nLine three\n\n`;
    expect(gameNotice("Rally at 18:00\n")).toEqual({ text: "Rally at 18:00", cut: false });
    expect(gameNotice(text)).toEqual({ text: "Line one", cut: true });
    expect(gameMail(text)).toBe(`Line one\n${"x".repeat(995)}\nLine three`);
  });

  it("keeps a line that ends exactly at 1000 characters", () => {
    const first = "x".repeat(1000);
    expect(gameNotice(`${first}\nMore`)).toEqual({ text: first, cut: true });
  });

  it("cuts one line over 1000 characters at its last word", () => {
    // 995 characters of words, then "tailored" across the 1000th: the cut drops it whole.
    const line = `${"word ".repeat(199)}tailored text`;
    expect(gameNotice(line)).toEqual({ text: "word ".repeat(199).trimEnd(), cut: true });
  });

  it("never splits an emoji at the cut", () => {
    const thumb = "👍🏽";
    expect(gameNotice(`${"a".repeat(999)}${thumb}b`)).toEqual({
      text: `${"a".repeat(999)}${thumb}`,
      cut: true,
    });
  });

  it("puts the title in bold and escapes markdown and mentions, but not web addresses", () => {
    expect(discordPost("Garden *rota*", "# Mon | water_the roses @here\nhttps://x.test/a_b")).toBe(
      "**Garden \\*rota\\***\n\n\\# Mon \\| water\\_the roses @\u200bhere\nhttps://x.test/a_b",
    );
  });

  it("keeps languages together while they fit and splits the rest into messages Discord takes", () => {
    const short = discordMessages("Rota", [{ name: "English", text: "Water." }], true);
    expect(short).toEqual(["**Rota**\n\nWater."]);
    const long = discordMessages(
      "Rota",
      [
        { name: "English", text: `${"a".repeat(1200)}\n${"b".repeat(1200)}` },
        { name: "Français", text: "c".repeat(300) },
      ],
      false,
    );
    expect(long.every((m) => m.length <= DISCORD_LIMIT)).toBe(true);
    expect(long).toEqual([
      `**English**\n${"a".repeat(1200)}`,
      `${"b".repeat(1200)}\n\n**Français**\n${"c".repeat(300)}`,
    ]);
  });

  it("splits one line over 2000 characters between whole graphemes", () => {
    const thumb = "👍🏽"; // four UTF-16 units, one grapheme
    const [one, two] = discordMessages(
      "Rota",
      [{ name: "EN", text: `${"a".repeat(1998)}${thumb}z` }],
      false,
    );
    expect(one).toBe("a".repeat(1998));
    expect(two).toBe(`${thumb}z`);
  });
});
