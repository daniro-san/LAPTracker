// The buddy on the card and in Follow-up (issue 828): by name while they are still a member, officers first
// in the list to pick from. Invented members.
import { describe, expect, it } from "vitest";

import { cardBuddy, buddyOf } from "./buddy";
import { WORKSPACE_DICTIONARIES } from "./dictionary";
import type { MemberFacts } from "./fact-fields";
import type { MemberRow } from "./members";

const t = WORKSPACE_DICTIONARIES.en;
const names = new Map([
  [1, "Aster"],
  [2, "Bram"],
  [3, "Cass"],
]);
const facts = { buddy: { value: 2, source: "officer", version: 3 } } as MemberFacts;
const row = (uid: number, name: string, rankCode: number, extra: Partial<MemberRow> = {}) =>
  ({ uid, name, rankCode, facts: {}, ...extra }) as MemberRow;

describe("a member's buddy (issue 828)", () => {
  it("is shown by name while the buddy is still a member, and not after they left", () => {
    expect(buddyOf(facts, 1, names)).toEqual({ uid: 2, name: "Bram" });
    names.delete(2);
    expect(buddyOf(facts, 1, names)).toBeNull();
    names.set(2, "Bram");
  });

  it("gives the card the name, the saved version and the other members, officers first", () => {
    const aster = row(1, "Aster", 101, { facts, buddy: { uid: 2, name: "Bram" } });
    const card = cardBuddy(
      aster,
      [aster, row(2, "Bram", 103), row(3, "Cass", 105), row(4, "Ada", 101), row(5, "Zed", 104)],
      t,
    );
    expect([card.name, card.version]).toEqual(["Bram", 3]);
    expect(card.options.map((o) => o.name)).toEqual(["Cass", "Zed", "Ada", "Bram"]);
    expect(card.words["card.buddy.line"]).toBe("Buddy: {name}");
  });
});
