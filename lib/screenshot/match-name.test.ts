import { describe, expect, it } from "vitest";

import { matchName } from "./match-name";
import { nameKey } from "./name-key";
import { parseAllianceDuelRanking } from "./parse-alliance-duel";
import { ogsCandidates, recorded } from "./test-helpers";

const members = [
  { uid: 1, names: ["Morvel"] },
  { uid: 2, names: ["Tavish•Fearne"] },
  { uid: 3, names: ["pindrel•fearne"] },
  { uid: 4, names: ["NewName", "OldName"] },
  { uid: 5, names: ["frankfox77"] },
];

describe("matchName", () => {
  it("matches a name by its exact key, whatever its decoration", () => {
    expect(matchName("R4 morvel ++", members)).toEqual({
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
    expect(matchName("Tavish", members)).toEqual({ status: "matched", uid: 2, via: "segment" });
    expect(matchName("Tavish•Fearne", [{ uid: 2, names: ["Tavish"] }])).toEqual({
      status: "matched",
      uid: 2,
      via: "segment",
    });
  });

  it("leaves a part shared by two joined names unsure", () => {
    const result = matchName("Fearne", members);
    expect(result.status).toBe("unsure");
    expect(result.status === "unsure" && result.suggestions.map((s) => s.uid).sort()).toEqual([
      2, 3,
    ]);
  });

  it("suggests a name one edit away, as unsure", () => {
    expect(matchName("Morve", members)).toEqual({
      status: "unsure",
      suggestions: [{ uid: 1, name: "Morvel", distance: 1 }],
    });
    expect(matchName("Movrel", members).status).toBe("unsure");
  });

  it("allows two edits only for names of eight characters or more", () => {
    expect(matchName("frankfox", members).status).toBe("unsure");
    expect(matchName("Mor", members).status).toBe("none");
    expect(matchName("Morvaa", members).status).toBe("none");
  });

  it("suggests nothing for a name read as fewer than three characters", () => {
    expect(matchName("ab", [{ uid: 1, names: ["abc"] }])).toEqual({ status: "none" });
  });

  it("offers at most three suggestions", () => {
    const rows = ["Morvel1", "Morvel2", "Morvel3", "Morvel4"].map((name, i) => ({
      uid: i,
      names: [name],
    }));
    const result = matchName("Morvel", rows);
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
      "zLark",
      "PelorKNine",
      "LadySu-moore",
      "Olvendry",
      "DrWobblesBrook",
      "jovalindor",
      "MissPickles",
      "Edda8412",
      "tinker",
      "Zbysziii",
      "Dr-Nobody-K",
      "quillon",
      "TómbWardens",
      "teDog",
      "EliR592",
      "OwltorBrowns",
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
    expect(matchName("tinker", ogsCandidates())).toMatchObject({
      status: "matched",
      via: "current",
    });
  });
});
