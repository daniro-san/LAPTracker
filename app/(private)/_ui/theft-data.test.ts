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
  rosterExact: true,
  kind,
  victimUid: 11,
  victimName: "Juniper",
  source: "typed",
  items: null,
  note: null,
});

const week = { from: new Date("2026-11-16T02:00:00Z"), to: new Date("2026-11-23T02:00:00Z") };
const day = (at: Date) => at.toISOString().slice(0, 10);
const formats = { when: day, date: day, sentence: day, day };
const t = theftWords(WORKSPACE_DICTIONARIES.en);
const warn = { tag: "OGs", zone: "UTC" };

describe("a theft's type on its row (D97)", () => {
  it("shows the type's label, and a dash on rows saved before the type was asked (D75)", () => {
    const groups = groupThefts([entry(1, "ops"), entry(2, null)], [], week);
    const [card] = theftCards(
      groups.map((g) => ({ ...g, contact: null })),
      t,
      formats,
      warn,
    );
    const kinds = card?.attackers[0]?.entries.map((e) => [e.id, e.kind]);
    expect(Object.fromEntries(kinds ?? [])).toEqual({ 1: "Ops", 2: "—" });
  });
});

describe("whom to contact (D97, amended 2026-11-19)", () => {
  it("names our server on the attacker and links the tracked alliance's page with its leader", () => {
    const groups = groupThefts([entry(1, "ops")], [], week);
    const leader = { name: "Quillon", at: new Date("2026-11-14T15:30:00Z") };
    const contact = { unionId: 67109944, name: "Natural Selection", leader };
    const [card] = theftCards(
      groups.map((g) => ({ ...g, contact })),
      t,
      formats,
      warn,
    );
    expect(card?.contact).toEqual({
      line: "On our server. Their leader: ⁨Quillon⁩, as of 2026-11-14",
      href: "/alliances/67109944/history",
      link: "Open the page of ⁨Natural Selection⁩",
    });
    expect(card?.attackers[0]?.server).toEqual({
      text: `Our server · #${SERVER}`,
      same: true,
      // Inferred from the roster, so the field is not pre-filled.
      value: null,
      notKnown: false,
    });
  });
});

describe("the warning to paste (D97, amended 2026-11-19)", () => {
  it("is offered only for an attacker on our server, not on another or an unknown one", () => {
    const one = (key: string, exact: boolean) => ({
      ...entry(1, "ops"),
      attackerKey: key,
      rosterExact: exact,
    });
    const groups = groupThefts(
      [one("uid:1", true), one("name:fernby", false), one("name:ashlock", false)],
      [],
      week,
      new Map([["name:fernby", 412]]),
    );
    const cards = theftCards(
      groups.map((g) => ({ ...g, contact: null })),
      t,
      formats,
      warn,
    ).flatMap((a) => a.attackers);
    const offered = Object.fromEntries(cards.map((c) => [c.key, c.warnings !== null]));
    expect(offered).toEqual({ "uid:1": true, "name:fernby": false, "name:ashlock": false });
  });
});
