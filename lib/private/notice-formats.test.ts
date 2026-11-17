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

  it("puts the title in bold and escapes markdown and mentions, but not web addresses", () => {
    expect(discordPost("Garden *rota*", "# Mon | water_the roses @here\nhttps://x.test/a_b")).toBe(
      "**Garden \\*rota\\***\n\n\\# Mon \\| water\\_the roses @​here\nhttps://x.test/a_b",
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
});
