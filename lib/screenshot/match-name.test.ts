import { describe, expect, it } from "vitest";

import { matchName } from "./match-name";
import { nameKey } from "./name-key";
import { parseAllianceDuelRanking } from "./parse-alliance-duel";
import { ogsCandidates, recorded } from "./test-helpers";

const members = [
  { uid: 1, names: ["Kilare"] },
  { uid: 2, names: ["Kasoar•Thorne"] },
  { uid: 3, names: ["motolex•thorne"] },
  { uid: 4, names: ["NewName", "OldName"] },
  { uid: 5, names: ["dannyboy90"] },
];

describe("matchName", () => {
  it("matches a name by its exact key, whatever its decoration", () => {
    expect(matchName("R4 kilare ++", members)).toEqual({
      status: "matched",
      uid: 1,
      via: "current",
    });
  });

  it("finds a renamed player by a past name", () => {
    expect(matchName("OldName", members)).toEqual({ status: "matched", uid: 4, via: "past" });
  });

  it("prefers a current name over another member's past name", () => {
    const rows = [
      { uid: 8, names: ["Zed", "Rex"] },
      { uid: 9, names: ["Rex"] },
    ];
    expect(matchName("Rex", rows)).toEqual({ status: "matched", uid: 9, via: "current" });
  });

  it("does not pick between two members that share a name", () => {
    const rows = [
      { uid: 8, names: ["Rex"] },
      { uid: 9, names: ["REX"] },
    ];
    const result = matchName("rex", rows);
    expect(result.status).toBe("unsure");
    expect(result.status === "unsure" && result.suggestions.map((s) => s.uid).sort()).toEqual([
      8, 9,
    ]);
  });

  it("matches one part of a joined name when only one member has it", () => {
    expect(matchName("Kasoar", members)).toEqual({ status: "matched", uid: 2, via: "segment" });
    expect(matchName("Kasoar•Thorne", [{ uid: 2, names: ["Kasoar"] }])).toEqual({
      status: "matched",
      uid: 2,
      via: "segment",
    });
  });

  it("leaves a part shared by two joined names unsure", () => {
    const result = matchName("Thorne", members);
    expect(result.status).toBe("unsure");
    expect(result.status === "unsure" && result.suggestions.map((s) => s.uid).sort()).toEqual([
      2, 3,
    ]);
  });

  it("suggests a name one edit away, as unsure", () => {
    expect(matchName("Kilar", members)).toEqual({
      status: "unsure",
      suggestions: [{ uid: 1, name: "Kilare", distance: 1 }],
    });
    expect(matchName("Kialre", members).status).toBe("unsure");
  });

  it("allows two edits only for names of eight characters or more", () => {
    expect(matchName("dannyboy", members).status).toBe("unsure");
    expect(matchName("Kil", members).status).toBe("none");
    expect(matchName("Kilaaa", members).status).toBe("none");
  });

  it("suggests nothing for a name read as fewer than three characters", () => {
    expect(matchName("ab", [{ uid: 1, names: ["abc"] }])).toEqual({ status: "none" });
  });

  it("offers at most three suggestions", () => {
    const rows = ["Kilare1", "Kilare2", "Kilare3", "Kilare4"].map((name, i) => ({
      uid: i,
      names: [name],
    }));
    const result = matchName("Kilare", rows);
    expect(result.status === "unsure" && result.suggestions).toHaveLength(3);
  });

  it("finds nothing for an unknown name or a name that is only decoration", () => {
    expect(matchName("Somebody Else", members)).toEqual({ status: "none" });
    expect(matchName("💙⚜️", members)).toEqual({ status: "none" });
  });

  it("matches the names read from recorded pages only to the members they belong to", () => {
    const roster = ogsCandidates();
    const pages = [
      parseAllianceDuelRanking(recorded("28-alliance-duel-weekly-mine"), { scope: "weekly" }),
      parseAllianceDuelRanking(recorded("31-alliance-duel-weekly-mine"), { scope: "weekly" }),
    ].flat();
    // What the screens show, by place: a misread name may be unsure or none, never another member.
    const shown = [
      "xCage",
      "ZunarJFive",
      "LadyLi-rosan",
      "Arephrey",
      "DrSquiggsJones",
      "sohannibal",
      "MissJackson",
      "Anna8603",
      "sinner",
      "Jancziii",
      "Dr-Noname-J",
      "beazord",
      "CrýptKeeper",
      "emCat",
      "AshH786",
      "DucktorJones",
    ];
    const results = pages.map((row) => matchName(row.name, roster));
    results.forEach((result, i) => {
      if (result.status !== "matched") return;
      const member = roster.find((m) => m.uid === result.uid);
      expect(nameKey(member?.names[0] ?? "")).toBe(nameKey(shown[i] ?? ""));
    });
    expect(results.filter((r) => r.status === "matched").length).toBeGreaterThanOrEqual(10);
  });

  it("matches a roster name that is spelled with a Cyrillic i and e", () => {
    expect(matchName("sinner", ogsCandidates())).toMatchObject({
      status: "matched",
      via: "current",
    });
  });
});
