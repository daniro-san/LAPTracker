// The "mostly untranslated" check (D81), on the invented weekly notice of the 11i runs (the real one stays out
// of the public repo) and the real answers gpt-oss-120b gave for it.
import { describe, expect, it } from "vitest";

import { mostlyUntranslated, untranslatedShare } from "./untranslated";

/** The notice as sent to French: "ALLIANCE DUEL" is already "DUEL D’ALLIANCE" (withOwnNames). */
const SENT = [
  "DUEL D’ALLIANCE this week",
  "Mon | SCOUTING: send scouts, use Raven Essence",
  "Tue | BUILDING: Construction Speedups",
  "Wed | RESEARCH: tech speedups",
  "Thu | HEROES: hero XP",
  "Fri | TROOPS: train T9",
  "Sat | BATTLE: Covert Operations at 20:00 ST",
  "HOMEWORK: save your speedups for Tuesday.",
].join("\n");

describe("mostly untranslated (D81)", () => {
  it("passes a clean translation, even with its headings left in capitals English", () => {
    const pt = [
      "DUELO DA ALIANÇA esta semana",
      "Seg | ESPIONAGEM: envie batedores, use Raven Essence",
      "Ter | CONSTRUÇÃO: Construction Speedups",
      "Qua | PESQUISA: acelerações de tecnologia",
      "Qui | HERÓIS: XP de herói",
      "Sex | TROPAS: treine T9",
      "Sáb | BATALHA: Covert Operations às 20:00 ST",
      "DEVER: guarde suas acelerações para terça.",
    ].join("\n");
    expect(mostlyUntranslated(SENT.replace("DUEL D’ALLIANCE", "DUELO DA ALIANÇA"), pt)).toBe(false);
    const frHeadings = [
      "DUEL D’ALLIANCE cette semaine",
      "LUN | SCOUTING : envoyez des éclaireurs, utilisez Raven Essence",
      "MAR | BUILDING : Construction Speedups",
      "MER | RESEARCH : accélérations technologiques",
      "JEU | HEROES : XP héros",
      "VEN | TROOPS : entraînez T9",
      "SAM | BATTLE : Covert Operations à 20:00 ST",
      "DEVOIR : conservez vos speedups pour mardi.",
    ].join("\n");
    expect(mostlyUntranslated(SENT, frHeadings)).toBe(false);
  });

  it("fails an answer with most lines still in English", () => {
    const fr = [
      "DUEL D’ALLIANCE this week",
      "Lun | SCOUTING : send scouts, use Raven Essence",
      "Mar | BUILDING : Construction Speedups",
      "Mer | RESEARCH : tech speedups",
      "Jeu | HEROES : hero XP",
      "Ven | TROOPS : train T9",
      "Sam | BATTLE : Covert Operations at 20:00 ST",
      "HOMEWORK : save your speedups for Tuesday.",
    ].join("\n");
    expect(untranslatedShare(SENT, fr)).toBeGreaterThanOrEqual(0.75);
    expect(mostlyUntranslated(SENT, fr)).toBe(true);
    // A real answer: weekdays and headings translated, the words after them left in English.
    const half = [
      "DUEL D’ALLIANCE cette semaine",
      "Lun | RECONNAISSANCE : send scouts, use Raven Essence",
      "Mar | CONSTRUCTION : Construction Speedups",
      "Mer | RECHERCHE : tech speedups",
      "Jeu | HÉROS : hero XP",
      "Ven | TROUPES : train T9",
      "Sam | BATAILLE : Covert Operations at 20:00 ST",
      "DEVOIR : save your speedups for Tuesday.",
    ].join("\n");
    expect(mostlyUntranslated(SENT, half)).toBe(true);
  });

  it("is not set off by names, tags, numbers, times, emoji or game terms that stay as written", () => {
    const sent =
      "[OGs]Mudkip 18:00 ST 👑\nAD 450K VIP Sanctuary\nRally at 20:00 ST, [OGs]Floki leads.";
    const pt =
      "[OGs]Mudkip 18:00 ST 👑\nAD 450K VIP Sanctuary\nRally às 20:00 ST, [OGs]Floki lidera.";
    expect(untranslatedShare(sent, pt)).toBe(0);
    expect(mostlyUntranslated(sent, pt)).toBe(false);
  });
});
