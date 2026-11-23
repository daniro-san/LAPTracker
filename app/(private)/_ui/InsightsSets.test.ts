// Where an Insights count opens its names (D158 rule 7 (c)): in place up to 12, a sheet or the side pane from
// 13 to 60, and past 60 a link straight to Members `?set=`. Invented names.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { levelsOf } from "@/lib/private/insights-days-words";
import type { MemberSet } from "@/lib/private/insights-sets";

import { FlowCard } from "./InsightsSections";
import { SetRow } from "./InsightsSets";

const t = WORKSPACE_DICTIONARIES.en;

const setOf = (n: number, onward: string | null = `Open these ${n} in Members ›`): MemberSet => ({
  kind: "zone",
  key: "zone-p60-p60-p60",
  people: Array.from({ length: n }, (_, i) => ({ uid: 100 + i, name: `P${i}`, current: true })),
  title: `Time zones · Paris · UTC+1: ${n} members`,
  onward,
});

const row = (set: MemberSet) =>
  renderToStaticMarkup(
    createElement(SetRow, { set, slug: "ogs", label: set.title, summary: "Paris", t }),
  );

describe("where an Insights count opens its names", () => {
  it("opens up to 12 names in place, ending with the link onward to Members", () => {
    const html = row(setOf(12));
    expect(html).toContain('<details id="who-zone-p60-p60-p60"');
    expect(html.match(/members\?m=1\d\d/g)).toHaveLength(12);
    expect(html).toContain('href="/w/ogs/members?set=zone:zone-p60-p60-p60"');
    expect(html).toContain("Open these 12 in Members ›");
  });

  it("opens 13 to 60 from a button for the sheet or the side pane, not in place", () => {
    for (const n of [13, 60]) {
      const html = row(setOf(n));
      expect(html).not.toContain("<details");
      expect(html).toMatch(
        /<button id="who-zone-p60-p60-p60" type="button" aria-haspopup="dialog"/,
      );
      // The names wait for the tap: none is on the page before it.
      expect(html).not.toContain("members?m=");
    }
  });

  it("links past 60 straight to Members, and keeps a set with no Members view in the sheet", () => {
    const far = row(setOf(61));
    expect(far).toMatch(/^<a href="\/w\/ogs\/members\?set=zone:zone-p60-p60-p60"/);
    expect(far).not.toContain("<button");
    // A week's leavers have no Members view: past 60 they still open in the sheet.
    expect(row(setOf(61, null))).toMatch(/^<button/);
  });

  it("links a week past 60 to Members only when the link holds everyone its count counts", () => {
    const week = (joined: number, left: number) => {
      const flow = {
        based: "Based on 7 daily updates.",
        weeks: [
          {
            label: "Week of Nov 9",
            drill: null,
            joined: {
              label: "joined",
              value: `+${joined}`,
              share: 0.5,
              set: { ...setOf(joined), kind: "flow_week" as const, key: "joined-2026-11-09" },
            },
            left: {
              label: "left",
              value: left > 0 ? `−${left}` : "0",
              share: 0,
              set:
                left > 0
                  ? {
                      ...setOf(left, null),
                      kind: "flow_week" as const,
                      key: "left-2026-11-09",
                    }
                  : null,
            },
          },
        ],
        came: [],
        went: [],
        tenure: [],
        newcomers: [],
      };
      const nav = { base: "/w/ogs/insights", levels: levelsOf({}) };
      return renderToStaticMarkup(
        createElement(FlowCard, { flow, level: null, day: null, nav, t, noData: "—", slug: "ogs" }),
      );
    };
    // 61 joined, nobody left: the count is the joiners, and Members lists exactly them.
    expect(week(61, 0)).toContain('href="/w/ogs/members?set=flow_week:joined-2026-11-09"');
    // 61 joined and 1 left: the count is 62, which Members cannot list; the sheet holds both lists.
    const both = week(61, 1);
    expect(both).not.toContain("members?set=flow_week");
    expect(both).toMatch(/<button id="who-week-0" type="button"/);
  });
});
