// Invented lines in the shapes measured on real onboarding chats (issue #297); never the real chats.
import { describe, expect, it } from "vitest";

import { parseOnboarding } from "./onboarding-parse";

const NOW = new Date("2026-11-16T12:00:00Z");
const read = (text: string) => parseOnboarding(text, NOW, "Etc/GMT+2");

describe("paste what they told you (#297)", () => {
  it("reads the main squad might in every measured shape", () => {
    const shapes = {
      "Zed 9.9 M for main squad": 9_900_000,
      "First squad is 8,442,626": 8_442_626,
      "6969172": 6_969_172,
      "Squadron 1 - 5,963,493": 5_963_493,
      "Esquadrão 1 - 5.963.493": 5_963_493,
      "poder 10.2M": 10_200_000,
      "9,9 M": 9_900_000,
      "9900k": 9_900_000,
    };
    for (const [line, might] of Object.entries(shapes))
      expect(read(line).squadMight, line).toBe(might);
  });

  it("reads the AD Tech %, and leaves a field empty for idk yet", () => {
    const shapes = {
      "69% for AD Tech": 69,
      "Alliance Duel 53%": 53,
      "pesquisa duelo da aliança tá 61%": 61,
      "59%": 59,
    };
    for (const [line, ad] of Object.entries(shapes)) expect(read(line).adTech, line).toBe(ad);
    expect(read("idk yet")).toEqual({
      squadMight: null,
      adTech: null,
      timeZones: [],
      languages: [],
    });
  });

  it("turns time zone words into IANA zones, best first", () => {
    const shapes = {
      PST: "America/Los_Angeles",
      "time zone ukraine": "Europe/Kyiv",
      "uk time zone, currently 2.04 pm": "Europe/London",
      "Brazil -3": "America/Sao_Paulo",
      "Fuso horario brasil / Brazil time zone": "America/Sao_Paulo",
    };
    for (const [line, zone] of Object.entries(shapes))
      expect(read(line).timeZones[0], line).toBe(zone);
    // "est" is French for "is", and Nome a city only next to "time zone".
    expect(read("Il est 14h, meu nome é Zed").timeZones).toEqual([]);
  });

  it("takes a number from a translated pair only when it carries its unit or both lines agree", () => {
    // The OCR misread the English line's 53% as 539.
    expect(read("Duelo da aliança 53%\nAlliance Duel 539").adTech).toBe(53);
    expect(read("Primeiro esquadrão 8.442.626\nFirst squad 8,442,626").squadMight).toBe(8_442_626);
    expect(read("Primeiro esquadrão 8442626\nFirst squad 8442628").squadMight).toBeNull();
  });

  it("names the languages written out, in the offered order", () => {
    expect(
      read("writing in cyrillic... understands English and a bit of français").languages,
    ).toEqual(["en", "fr"]);
  });

  it("reads OCR lines as it reads a paste", () => {
    expect(read(["Lv.25 [0Gs] Zed", "9.9 M for main squad", "69%", "PST"].join("\n"))).toEqual(
      parseOnboarding(["Lv.25 [0Gs] Zed", "9.9 M for main squad", "69%", "PST"], NOW, "Etc/GMT+2"),
    );
  });
});
