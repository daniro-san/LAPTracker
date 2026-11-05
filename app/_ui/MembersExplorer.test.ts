import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MemberCount } from "./MembersExplorer";

const html = (props: { count: number; capacity: number | null; shown: number | null }) =>
  renderToStaticMarkup(createElement(MemberCount, props)).replace(/<[^>]+>/g, "");

describe("MemberCount", () => {
  it("reads members over the capacity the API reports, or the plain count without one", () => {
    expect(html({ count: 97, capacity: 100, shown: null })).toBe("Members 97 / 100");
    expect(html({ count: 97, capacity: null, shown: null })).toBe("Members 97");
  });

  it("adds how many are shown only while a filter is on", () => {
    expect(html({ count: 97, capacity: 100, shown: 12 })).toBe("Members 97 / 100 · 12 shown");
    expect(html({ count: 97, capacity: 100, shown: null })).not.toContain("shown");
  });
});
