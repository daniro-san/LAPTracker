// Follow-up's ready message (issue 460, D140): every reason offers its line, every fact still to ask is
// named, and the language is the member's (recorded first, then the game's), else nobody's.
import { describe, expect, it } from "vitest";

import { messageLanguage, readyMessage, readyWords } from "./ready-message";

const base = { name: "Wren", isNew: false, reasons: [], tip: false, toAsk: [] } as const;

describe("the ready message (D140)", () => {
  it("offers a line for each reason and the tip, and ends warmly (never a thanks for the tip alone)", () => {
    const en = readyWords("en");
    expect(readyMessage(en, { ...base, reasons: ["idle", "might"] })).toBe(
      "Hey Wren! How are things going? All good on your side? Just checking in 🙂",
    );
    expect(readyMessage(en, { ...base, reasons: ["might"] })).toContain(
      "How's the game going? Need a hand with anything?",
    );
    expect(readyMessage(en, { ...base, reasons: ["kvk"] })).toContain("How did KvK go for you?");
    expect(readyMessage(en, { ...base, tip: true })).toBe(
      "Hey Wren! Small tip: helping alliance mates gives you Alliance Help coins, up to 1,000 a day. Have fun! 🙂",
    );
  });

  it("welcomes a new member and names every fact still to ask, in their language", () => {
    const ask = { ...base, isNew: true, toAsk: ["squadMight", "timeZone", "languages"] } as const;
    expect(readyMessage(readyWords("en"), ask)).toBe(
      "Hey Wren, welcome to the alliance! Glad to have you. Quick one for the alliance sheet: could you tell me your main squad might, time zone and languages? Thanks! 🙂",
    );
    expect(readyMessage(readyWords("pt-BR"), { ...ask, toAsk: ["troopTier", "adTech"] })).toBe(
      "Oi Wren, que bom ter você na aliança! Uma rapidinha para a planilha da aliança: pode me passar o tier das tropas e a AD Tech? Valeu! 🙂",
    );
    expect(readyMessage(readyWords("fr"), { ...ask, toAsk: ["timeZone"] })).toContain(
      "tu peux me donner ton fuseau horaire ?",
    );
  });

  it("takes the recorded language first, then the game's; none when neither is written", () => {
    expect(messageLanguage(["es", "fr", "en"])).toBe("fr");
    expect(messageLanguage([null, "pt"])).toBe("pt-BR");
    expect(messageLanguage(["de", null])).toBeNull();
  });
});
