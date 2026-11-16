import { describe, expect, it } from "vitest";

import { parseSecretOpsReport } from "./parse-secret-ops";
import { recorded } from "./test-helpers";

describe("parseSecretOpsReport", () => {
  it("tells thefts from helps on the French report", () => {
    const entries = parseSecretOpsReport(recorded("53-secret-ops-report"));
    expect(entries.map((e) => e.kind)).toEqual(["help", "theft", "theft", "help", "help", "help"]);
  });

  it("reads the tag, the name and the time of each entry", () => {
    const entries = parseSecretOpsReport(recorded("53-secret-ops-report"));
    expect(entries[2]).toMatchObject({ kind: "theft", tag: "VNC", at: "11-15 13:46" });
    expect(entries[3]).toMatchObject({
      kind: "help",
      tag: "OGs",
      name: "Ducktorjones",
      at: "11-15 11:52",
    });
  });

  it("keeps two thefts by one player as two entries", () => {
    const entries = parseSecretOpsReport(recorded("54-secret-ops-report"));
    expect(entries.filter((e) => e.name === "Golgsunny")).toHaveLength(2);
  });

  it("reads a thief whose closing bracket was misread, with no tag", () => {
    const entries = parseSecretOpsReport(recorded("53-secret-ops-report"));
    expect(entries[1]).toMatchObject({ kind: "theft", tag: "", name: "dpxjone234" });
  });

  it("reads a time whose space was lost", () => {
    const entries = parseSecretOpsReport(recorded("54-secret-ops-report"));
    expect(entries.find((e) => e.name === "ANMcinalice")?.at).toBe("11-14 17:34");
  });

  it("returns an entry with no kind when its sentence was cut off or unreadable", () => {
    // Invented OCR text: the second entry is cut at the bottom edge, with no sentence under it.
    const entries = parseSecretOpsReport([
      "[OGs]Seesky",
      "vous a aider a d'obtenir vos récompenses de quéte",
      "11-15 11:49",
      "[VNC]BugaBoo 11-15 13:46",
      "~~ = ©",
    ]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ kind: "help", name: "Seesky" });
    expect(entries[1]).toMatchObject({
      kind: null,
      tag: "VNC",
      name: "BugaBoo",
      at: "11-15 13:46",
    });
  });

  it("reads the English wording (built from the French structure, not checked in the game)", () => {
    const entries = parseSecretOpsReport([
      "[VNC]BugaBoo 11-15 13:46",
      "stole your quest rewards",
      "[OGs]Seesky",
      "helped you get your quest rewards.",
      "11-15 11:49",
    ]);
    expect(entries.map((e) => [e.kind, e.tag, e.name, e.at])).toEqual([
      ["theft", "VNC", "BugaBoo", "11-15 13:46"],
      ["help", "OGs", "Seesky", "11-15 11:49"],
    ]);
  });

  it("reads the Portuguese wording (built from the French structure, not checked in the game)", () => {
    const entries = parseSecretOpsReport([
      "[VNC]BugaBoo 11-15 13:46",
      "roubou suas recompensas de missão",
      "[OGs]Seesky",
      "ajudou você a obter suas recompensas de missão.",
      "11-15 11:49",
    ]);
    expect(entries.map((e) => [e.kind, e.name, e.at])).toEqual([
      ["theft", "BugaBoo", "11-15 13:46"],
      ["help", "Seesky", "11-15 11:49"],
    ]);
  });
});
