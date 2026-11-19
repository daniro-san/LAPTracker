// Home's "Recent activity" list state (D108, 2026-11-18): "Show less" goes back to the first page.
import { describe, expect, it } from "vitest";

import { collapsed, listOf, withPage } from "./activity-list";

const line = (text: string) => ({ text, at: "2026-11-20T12:00:00.000Z", ago: "now", run: [] });

describe("activity list", () => {
  it("adds each page after the first, and Show less returns to the first page and its cursor", () => {
    const first = listOf({ lines: [line("a")], next: 30 });
    const two = withPage(withPage(first, { lines: [line("b")], next: 20 }), {
      lines: [line("c")],
      next: null,
    });
    expect([...two.first, ...two.more].map((l) => l.text)).toEqual(["a", "b", "c"]);
    expect(two.next).toBeNull();
    expect(collapsed(two)).toEqual(first);
  });
});
