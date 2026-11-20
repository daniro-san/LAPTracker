// The member card's tabs (issue 461, D136): a pick always opens its tab; storage only remembers it, best
// effort, so blocked storage (private mode) never freezes the tabs.
import { describe, expect, it } from "vitest";

import { pickTab, rememberedTab, type TabStore } from "./MemberCardTabs";

describe("the member card's tabs", () => {
  it("opens the picked tab when storage is blocked, and remembers it when storage works", () => {
    const blocked: TabStore = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(pickTab("squads", blocked)).toBe("squads");
    expect(rememberedTab(blocked)).toBe("overview");
    expect(pickTab("info", null)).toBe("info");

    const saved = new Map<string, string>();
    const working: TabStore = {
      getItem: (k) => saved.get(k) ?? null,
      setItem: (k, v) => void saved.set(k, v),
    };
    expect(rememberedTab(working)).toBe("overview");
    expect(pickTab("history", working)).toBe("history");
    expect(rememberedTab(working)).toBe("history");
  });
});
