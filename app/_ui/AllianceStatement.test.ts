import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";
import type { AllianceStatement } from "@/lib/queries";

import { AllianceStatementCard, joiningParts } from "./AllianceStatement";
import type { Clock } from "./format";

const clock = { day: () => "Nov 19" } as unknown as Clock;
const base: AllianceStatement = {
  day: "2026-11-19",
  text: "Be kind.\nTrain daily.",
  lang: "de",
  open: false,
  minMight: 8_000_000,
  minHq: 14,
  members: 97,
  capacity: 100,
};
const card = (s: AllianceStatement | null) =>
  renderToStaticMarkup(
    createElement(AllianceStatementCard, { statement: s, clock, locale: "en", copy: en }),
  );

const line = (s: AllianceStatement) => joiningParts(s, "en", en).join(" · ");

describe("joiningParts", () => {
  it("open: says so, with the HQ minimum and the free seats", () => {
    const s = { ...base, open: true, minMight: null, minHq: 15, members: 73 };
    expect(line(s)).toBe("Open to join · HQ 15+ · 27 seats open (73/100)");
  });

  it("by application: compact might, HQ level and one free seat", () => {
    expect(line({ ...base, members: 99 })).toBe(
      "By application · 8.00M+ might · HQ 14+ · 1 seat open (99/100)",
    );
  });

  it("full: says so, even above the cap", () => {
    expect(line({ ...base, members: 101 })).toContain("Full (101/100)");
  });
});

describe("AllianceStatementCard", () => {
  it("shows the alliance's text as plain text in its language, labelled as theirs, with the read's date", () => {
    const html = card({ ...base, text: "<b>Hi</b> see https://example.org" });
    expect(html).toContain("Written by the alliance in game");
    expect(html).toContain('lang="de"');
    expect(html).toContain("&lt;b&gt;Hi&lt;/b&gt; see https://example.org");
    expect(html).not.toContain("<a ");
    expect(html).toContain("As of Nov 19");
    // A short text needs no Show all.
    expect(html).not.toContain("Show all");
  });

  it("cuts a long text with a Show all button", () => {
    const html = card({
      ...base,
      text: Array.from({ length: 8 }, (_, i) => `Rule ${i}`).join("\n"),
    });
    expect(html).toContain("line-clamp-6");
    expect(html).toContain("Show all");
  });

  it("no statement: the joining line alone; no read: no card", () => {
    const html = card({ ...base, text: null });
    expect(html).toContain("Joining");
    expect(html).not.toContain("Written by the alliance");
    expect(card(null)).toBe("");
  });
});
