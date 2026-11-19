// DESIGN.md "Layout components" (D122): column priorities, the phone's page actions and the sidebar's rows.
import { describe, expect, it } from "vitest";

import { cellClass, sidebarEntries, splitActions } from "./layout-rules";

describe("cellClass", () => {
  it("shows a column always, from 640, from 1024 or from 1440", () => {
    expect(cellClass("always")).toBe("table-cell");
    expect(cellClass("sm")).toBe("hidden sm:table-cell");
    expect(cellClass("lg")).toBe("hidden lg:table-cell");
    expect(cellClass("wide")).toBe("hidden wide:table-cell");
  });
});

describe("splitActions", () => {
  it("keeps the main action in view on a phone and moves the rest to More, in their order", () => {
    const a = { key: "shot", node: null };
    const b = { key: "paste", node: null, primary: true };
    const c = { key: "add", node: null };
    expect(splitActions([a, b, c])).toEqual({ shown: b, more: [a, c] });
    expect(splitActions([a, c])).toEqual({ shown: a, more: [c] });
    expect(splitActions([])).toEqual({ shown: null, more: [] });
  });
});

describe("sidebarEntries", () => {
  const items = [
    { id: "home", label: "Home", href: "/w/x" },
    {
      id: "days",
      label: "Calendar",
      href: "/w/x/calendar",
      views: [
        { id: "caravans", label: "Caravans", href: "/w/x/calendar/caravans" },
        { id: "notices", label: "Notices", href: "/w/x/notices" },
      ],
    },
    { id: "soon", label: "Later" },
  ];

  it("lists each destination then its views, and marks the open destination when no view is open", () => {
    const rows = sidebarEntries(items, "days");
    expect(rows.map((r) => [r.label, r.depth, r.current ?? null, r.within])).toEqual([
      ["Home", 0, null, false],
      ["Calendar", 0, "page", true],
      ["Caravans", 1, null, false],
      ["Notices", 1, null, false],
      ["Later", 0, null, false],
    ]);
    expect(rows[4]?.href).toBeUndefined();
  });

  it("gives aria-current to the open view only, and keeps its destination marked", () => {
    const rows = sidebarEntries(items, "days", "notices");
    expect(rows.filter((r) => r.current === "page").map((r) => r.label)).toEqual(["Notices"]);
    expect(rows.find((r) => r.label === "Calendar")?.within).toBe(true);
    // A view of another destination is not current.
    expect(
      sidebarEntries(items, "home", "notices")
        .filter((r) => r.current)
        .map((r) => r.label),
    ).toEqual(["Home"]);
  });
});
