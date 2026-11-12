import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const { AdminActions } = await import("./AdminActions");

const render = (running: { phase: string; event: string; startedText: string }[]) =>
  renderToStaticMarkup(
    createElement(AdminActions, {
      beforeAtText: "Sat 10:00",
      current: {
        id: null,
        name: "Saturday Event 2026-11-07",
        title: "Saturday Event",
        stateText: "Sat 12:00 · in 3 days · Before not taken, After not taken",
        rowFromText: "Fri 10:00",
      },
      manual: null,
      daily: null,
      running,
    }),
  );

describe("AdminActions while a run is in progress", () => {
  it("says what runs and turns every seal and the round button off", () => {
    const html = render([
      { phase: "Before snapshot", event: "Manual round", startedText: "Thu 19:14" },
    ]);

    expect(html).toContain("A run is in progress");
    expect(html).toContain("Before snapshot, Manual round. Started Thu 19:14.");
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(4); // Before, After, Rehearse, Start a manual round
    expect(buttons.every((b) => b.includes(' disabled=""'))).toBe(true);
  });

  it("leaves them on when nothing runs", () => {
    const html = render([]);

    expect(html).not.toContain("A run is in progress");
    expect((html.match(/<button[^>]* disabled=""/g) ?? []).length).toBe(0);
  });
});
