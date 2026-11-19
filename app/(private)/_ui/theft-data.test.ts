import { describe, expect, it } from "vitest";

import { SERVER } from "@/config/alliances";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { groupThefts, type TheftEntry } from "@/lib/private/theft-groups";

import { theftCards, theftWords } from "./theft-data";

const entry = (id: number, kind: TheftEntry["kind"]): TheftEntry => ({
  id,
  at: new Date(`2026-11-17T1${id}:00:00Z`),
  attackerKey: "uid:1",
  attackerName: "Marigold",
  attackerTag: "VNC",
  attackerServer: null,
  kind,
  victimUid: 11,
  victimName: "Juniper",
  source: "typed",
  items: null,
  note: null,
});

const week = { from: new Date("2026-11-16T02:00:00Z"), to: new Date("2026-11-23T02:00:00Z") };
const day = (at: Date) => at.toISOString().slice(0, 10);
const formats = { when: day, date: day, day };
const t = theftWords(WORKSPACE_DICTIONARIES.en);

describe("a theft's type on its row (D97)", () => {
  it("shows the type's label, and a dash on rows saved before the type was asked (D75)", () => {
    const groups = groupThefts([entry(1, "ops"), entry(2, null)], [], week);
    const [card] = theftCards(
      groups.map((g) => ({ ...g, contact: null })),
      t,
      formats,
      () => null,
    );
    const kinds = card?.attackers[0]?.entries.map((e) => [e.id, e.kind]);
    expect(Object.fromEntries(kinds ?? [])).toEqual({ 1: "Ops", 2: "—" });
  });
});

describe("whom to contact (D97, amended 2026-11-19)", () => {
  it("names our server on the attacker and links the tracked alliance's page with its leader", () => {
    const groups = groupThefts([entry(1, "ops")], [], week);
    const contact = { unionId: 67109944, name: "Natural Selection", leader: "Quillon" };
    const [card] = theftCards(
      groups.map((g) => ({ ...g, contact })),
      t,
      formats,
      () => null,
    );
    expect(card?.contact).toEqual({
      line: "On our server. Their leader: ⁨Quillon⁩",
      href: "/alliances/67109944/history",
      link: "Open the page of ⁨Natural Selection⁩",
    });
    expect(card?.attackers[0]?.server).toEqual({
      text: `Our server · #${SERVER}`,
      same: true,
      value: 325,
    });
  });
});
