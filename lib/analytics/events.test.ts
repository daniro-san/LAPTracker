// The custom events' properties are closed lists of words, never a free string or a number: checked by tsc
// (`pnpm typecheck` compiles this file), so a property that could carry a name or typed text fails `pnpm check`.
import type { PostHog } from "posthog-js";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { track, type AnalyticsEvent, type AnalyticsEvents } from "./events";

type PropertyValue = {
  [E in AnalyticsEvent]: AnalyticsEvents[E][keyof AnalyticsEvents[E]];
}[AnalyticsEvent];

describe("custom events (D77)", () => {
  it("take only closed lists of words as property values", () => {
    expectTypeOf<string extends PropertyValue ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<number extends PropertyValue ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<PropertyValue>().toExtend<string | boolean>();
    // Not loaded in tests, so these calls send nothing; tsc checks them.
    track("ws_filter_used", { filter: "who" });
    // @ts-expect-error a free string is not a filter
    track("ws_filter_used", { filter: "Ana" as string });
    // @ts-expect-error no event outside the closed list
    track("ws_member_opened");
    // @ts-expect-error an event without properties takes none
    track("ws_copy_spreadsheet", { name: "Ana" });
    // @ts-expect-error no extra property next to the closed one
    track("ws_language_switched", { language: "fr", text: "Ana" });
    // D115's events: enums only, so no count of members, no name and no value.
    track("ws_review_requested", { scope: "language", to: "team" });
    // @ts-expect-error a reviewer's name is not a target
    track("ws_review_requested", { scope: "notice", to: "Ana" as string });
    // @ts-expect-error no member value rides on a mark
    track("ws_roll_call_marked", { how: "tap", uid: 4242 });
  });
});

describe("identify (D115)", () => {
  /** A fresh copy of the module with a loaded stand-in SDK in the given mode. */
  async function loaded(cookieless: "on_reject" | undefined, optedIn = false) {
    vi.resetModules();
    const events = await import("./events");
    const ph = {
      config: { cookieless_mode: cookieless },
      has_opted_in_capturing: () => optedIn,
      get_distinct_id: () => "anon",
      identify: vi.fn(),
    };
    events.loadAnalytics(async () => ph as unknown as PostHog);
    await Promise.resolve();
    await Promise.resolve();
    events.identify("ws_0123", "officer", "ogs");
    return ph.identify;
  }

  it("names the person on a desk page load, and never on a cookieless one", async () => {
    expect(await loaded(undefined)).toHaveBeenCalledWith("ws_0123", {
      tier: "officer",
      workspace: "ogs",
    });
    // A public page load, then a client-side visit to the desk: never, whether or not the visitor allowed.
    expect(await loaded("on_reject")).not.toHaveBeenCalled();
    expect(await loaded("on_reject", true)).not.toHaveBeenCalled();
  });
});

describe("the workspace on every event (issue 452)", () => {
  it("is registered on a desk page load, never on one that started on a public page, and sign-out clears it", async () => {
    const loaded = async (cookieless: "on_reject" | undefined) => {
      vi.resetModules();
      const events = await import("./events");
      const props = new Map<string, unknown>();
      const ph = {
        config: { cookieless_mode: cookieless },
        register: (p: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(p)) props.set(k, v);
        },
        unregister: (name: string) => props.delete(name),
        // posthog-js's reset clears them too; this stand-in does not, so the test sees sign-out's own step.
        reset: vi.fn(),
      };
      events.loadAnalytics(async () => ph as unknown as PostHog);
      await Promise.resolve();
      await Promise.resolve();
      events.registerWorkspace("ogs", "OGs");
      return { events, props: () => Object.fromEntries(props), ph };
    };
    const desk = await loaded(undefined);
    expect(desk.props()).toEqual({ workspace: "ogs", alliance: "OGs" });
    desk.events.forgetPerson();
    expect(desk.props()).toEqual({});
    expect(desk.ph.reset).toHaveBeenCalled();
    expect((await loaded("on_reject")).props()).toEqual({});
  });
});

describe("the tracking plan (D115)", () => {
  it("lists `workspace` and `alliance` on every ws_* event (issue 452)", async () => {
    const { readFileSync } = await import("node:fs");
    const { ANALYTICS_EVENTS } = await import("./events");
    const plan = readFileSync("docs/analytics/tracking-plan.md", "utf8");
    // The event tables' rows: every row that names a ws_* event lists both properties.
    const rows = plan.split("\n").filter((line) => line.startsWith("|"));
    for (const name of [...ANALYTICS_EVENTS, "ws_action"]) {
      const naming = rows.filter((row) => row.includes(`\`${name}\``));
      expect(naming, name).not.toEqual([]);
      for (const row of naming) expect(row, name).toMatch(/`workspace`.*`alliance`/);
    }
  });

  it("lists every browser event, every server event and every desk feature and action", async () => {
    const { readFileSync } = await import("node:fs");
    const { DESK_ACTIONS, DESK_FEATURES } = await import("./server");
    const { ANALYTICS_EVENTS } = await import("./events");
    const plan = readFileSync("docs/analytics/tracking-plan.md", "utf8");
    const named = [
      ...ANALYTICS_EVENTS,
      "$exception",
      "$ai_generation",
      "discord_command_used",
      "ws_action",
      ...DESK_FEATURES,
      ...DESK_ACTIONS,
    ];
    expect(named.filter((name) => !plan.includes(`\`${name}\``))).toEqual([]);
    // Every event the type allows is in the run-time list, so the check above covers them all.
    expectTypeOf<AnalyticsEvent>().toEqualTypeOf<(typeof ANALYTICS_EVENTS)[number]>();
  });
});
