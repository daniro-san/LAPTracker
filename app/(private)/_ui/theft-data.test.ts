import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { groupThefts, type TheftEntry } from "@/lib/private/theft-groups";

import { theftCards, theftWords } from "./theft-data";

const entry = (id: number, kind: TheftEntry["kind"]): TheftEntry => ({
  id,
  at: new Date(`2026-11-17T1${id}:00:00Z`),
  attackerKey: "uid:1",
  attackerName: "Marigold",
  attackerTag: "VNC",
  kind,
  victimUid: 11,
  victimName: "Juniper",
  source: "typed",
  note: null,
});

describe("a theft's type on its row (D97)", () => {
  it("shows the type's label, and a dash on rows saved before the type was asked (D75)", () => {
    const week = { from: new Date("2026-11-16T02:00:00Z"), to: new Date("2026-11-23T02:00:00Z") };
    const groups = groupThefts([entry(1, "ops"), entry(2, null)], [], week);
    const day = (at: Date) => at.toISOString().slice(0, 10);
    const [card] = theftCards(groups, theftWords(WORKSPACE_DICTIONARIES.en), {
      when: day,
      date: day,
      day,
    });
    const kinds = card?.attackers[0]?.entries.map((e) => [e.id, e.kind]);
    expect(Object.fromEntries(kinds ?? [])).toEqual({ 1: "Ops", 2: "—" });
  });
});
