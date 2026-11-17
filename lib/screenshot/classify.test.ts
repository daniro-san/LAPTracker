import { describe, expect, it } from "vitest";

import { classifyScreen, readScreen } from "./classify";
import type { ScreenshotReader } from "./read-screenshot";
import { recorded } from "./test-helpers";

const kindOf = (lines: string[]) => {
  const c = classifyScreen(lines);
  return [c.kind, c.scope, c.scopeSure];
};

describe("classifyScreen", () => {
  it("recognises the ranking screens from their recorded text", () => {
    expect(kindOf(recorded("98-alliance-duel-weekly-phone"))).toEqual([
      "alliance_duel",
      "weekly",
      false,
    ]);
    // The Daily tab shows its day tabs, Mon to Sat: daily for sure.
    expect(kindOf(recorded("99-alliance-duel-daily-phone"))).toEqual([
      "alliance_duel",
      "daily",
      true,
    ]);
    // Donation's Daily and Weekly tabs read the same: weekly, to be confirmed.
    expect(kindOf(recorded("88-donation-daily-phone"))).toEqual(["donation", "weekly", false]);
    expect(kindOf(recorded("89-kills-phone"))).toEqual(["kills", null, true]);
    expect(kindOf(recorded("90-might-phone"))).toEqual(["might", null, true]);
    expect(classifyScreen(recorded("53-secret-ops-report")).kind).toBe("secret_ops");
  });

  it("recognises the other sessions' screens (invented lines, after the real reads)", () => {
    const damage = ["Reward Details", "Damage Phase: 5", "MVP Bonus: Reward x10", "LD21 17.0B"];
    const undead = ["Mail", "Your Alliance withstood", "1280 waves of attacks on Lv.4 difficulty."];
    const elixir = ["Elixir Battle", "Participants: 18/20", "Team A", "Team B"];
    expect(classifyScreen(damage).kind).toBe("damage_event");
    expect(classifyScreen(undead).kind).toBe("undead_mail");
    expect(classifyScreen(elixir).kind).toBe("elixir_teams");
  });

  it("needs a chat page's several sender lines; a notice with two comments is not a chat", () => {
    // Invented names and messages in the shape of a chat sender line (the Lv is often misread).
    const message = (name: string, text: string) => [`WA XX. 28 ¢ [0Gs] ${name}`, text];
    const chat = [
      "Kingdom Alliance | Private Chat",
      ...message("Ana", "Main squad 12.3 M"),
      ...message("Bo", "Hello everyone"),
      ...message("Ana", "AD Tech 55%"),
    ];
    expect(classifyScreen(chat).kind).toBe("member_update");
    const notice = ["SCHEDULE | MONDAY", ...message("Bo", "Good morning")];
    expect(classifyScreen([...notice, ...message("Cy", "See you later")]).kind).toBe(null);
  });

  it("recognises a map, and says nothing about a picture it cannot place", () => {
    // Invented lines: the map's labels and controls as the OCR reads them.
    const map = ["0/s 15 8 12 0/s", "#325 [OGs] MissJackson", "P9325 [ods] Biomat", "Map", "Bag"];
    expect(classifyScreen(map).kind).toBe("map");
    expect(classifyScreen(["Mail", "Weekly Donation Ranking Reward", "Congratulations"]).kind).toBe(
      null,
    );
    expect(classifyScreen([]).kind).toBe(null);
  });
});

describe("readScreen", () => {
  it("converts once, and reads again in plain grey when the first reading is not recognised", async () => {
    const calls: unknown[] = [];
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const reader: ScreenshotReader = {
      read: async (image, options) => {
        calls.push([image === png, options]);
        return options?.flatten === false ? ["0/s 15 0/s", "Map", "Mail"] : ["?"];
      },
      toPng: async () => {
        calls.push("toPng");
        return png;
      },
      close: async () => undefined,
    };
    const read = await readScreen(reader, new Uint8Array(1), { statusBar: true });
    expect(read.classified.kind).toBe("map");
    expect(calls).toEqual([
      "toPng",
      [true, { statusBar: true }],
      [true, { statusBar: true, flatten: false }],
    ]);
  });
});
