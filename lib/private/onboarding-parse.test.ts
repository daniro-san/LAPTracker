// Invented lines in the shapes measured on real onboarding chats (issue #297); never the real chats.
import { describe, expect, it } from "vitest";

import { parseOnboarding } from "./onboarding-parse";

const NOW = new Date("2026-11-16T12:00:00Z");
const read = (text: string) => parseOnboarding(text, NOW, "Etc/GMT+2");

describe("paste what they told you (#297)", () => {
  it("reads the main squad might in every measured shape", () => {
    const shapes = {
      "Zed 12.3 M for main squad": 12_300_000,
      "First squad is 7,215,408": 7_215_408,
      "6481293": 6_481_293,
      "Squadron 1 - 4,830,112": 4_830_112,
      "Esquadrão 1 - 4.830.112": 4_830_112,
      "poder 11.4M": 11_400_000,
      "12,3 M": 12_300_000,
      "12300k": 12_300_000,
    };
    for (const [line, might] of Object.entries(shapes))
      expect(read(line).squadMight, line).toBe(might);
  });

  it("reads the AD Tech %, and leaves a field empty for idk yet", () => {
    const shapes = {
      "55% for AD Tech": 55,
      "Alliance Duel 47%": 47,
      "pesquisa duelo da aliança tá 62%": 62,
      "58%": 58,
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
    // The OCR misread the English line's 47% as 479.
    expect(read("Duelo da aliança 47%\nAlliance Duel 479").adTech).toBe(47);
    expect(read("Primeiro esquadrão 7.215.408\nFirst squad 7,215,408").squadMight).toBe(7_215_408);
    expect(read("Primeiro esquadrão 7215408\nFirst squad 7215402").squadMight).toBeNull();
  });

  it("names the languages written out, in the offered order", () => {
    expect(
      read("writing in cyrillic... understands English and a bit of français").languages,
    ).toEqual(["en", "fr"]);
  });

  it("reads OCR lines as it reads a paste", () => {
    expect(read(["Lv.25 [0Gs] Zed", "12.3 M for main squad", "55%", "PST"].join("\n"))).toEqual(
      parseOnboarding(["Lv.25 [0Gs] Zed", "12.3 M for main squad", "55%", "PST"], NOW, "Etc/GMT+2"),
    );
  });
});
