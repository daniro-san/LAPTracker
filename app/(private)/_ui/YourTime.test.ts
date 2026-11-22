// "Your time" beside a server time (D101): when the viewer's clock is on another day, it says so in words
// (issue 585: "(−1 d)" read as cryptic to an officer who reads English as a second language).
import { describe, expect, it } from "vitest";

import { zonedInstant } from "@/lib/private/calendar-time";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { calendarWords } from "./calendar-data";
import { yourTime } from "./YourTime";

describe("your time", () => {
  it("says the raid's reset is the day before on a viewer's clock behind the server's", () => {
    // KvK Saturday's reset, 00:00 ST (UTC−2), is still Friday 23:00 in São Paulo (UTC−3).
    const at = zonedInstant("2026-11-21", 0, "Etc/GMT+2");
    const words = calendarWords(WORKSPACE_DICTIONARIES.en);
    expect(yourTime(at, "2026-11-21", "America/Sao_Paulo", words)).toBe(
      "23:00 your time (the day before)",
    );
  });
});
