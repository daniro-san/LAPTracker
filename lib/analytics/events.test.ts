// The custom events' properties are closed lists of words, never a free string or a number: checked by tsc
// (`pnpm typecheck` compiles this file), so a property that could carry a name or typed text fails `pnpm check`.
import { describe, expectTypeOf, it } from "vitest";

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
    track("ws_filter_used", { filter: "checkin" });
    // @ts-expect-error a free string is not a filter
    track("ws_filter_used", { filter: "Ana" as string });
    // @ts-expect-error no event outside the closed list
    track("ws_member_opened");
    // @ts-expect-error an event without properties takes none
    track("ws_copy_spreadsheet", { name: "Ana" });
    // @ts-expect-error no extra property next to the closed one
    track("ws_language_switched", { language: "fr", text: "Ana" });
  });
});
