import { describe, expect, it } from "vitest";

import { awayOn, awayUntil } from "./fact-fields";
import { callOrder, REST, tally, teamOrder, toggled, type Mark } from "./roll-call-rules";

const marks = (pairs: [number, Mark | null][]) => new Map(pairs);

describe("roll call rules (issue 298)", () => {
  it("counts a member with no mark, or a cleared one, only as not set, never as a no (D75)", () => {
    const members = [1, 2, 3, 4, 5, 6].map((uid) => ({ uid, away: uid === 6 }));
    const t = tally(
      members,
      marks([
        [1, "yes"],
        [2, "no"],
        [3, "assumed"],
        [4, null],
        [6, "no"],
      ]),
    );
    expect(t).toEqual({ yes: 1, no: 1, assumed: 1, notSet: 2, away: 1 });
  });

  it("fills the rest per kind, and a second tap of the same button clears", () => {
    expect(REST).toEqual({ shield: "assumed", elixir: "no", raid: "yes", plunder: "yes" });
    expect([toggled(null, "yes"), toggled("yes", "yes"), toggled("assumed", "no")]).toEqual([
      "yes",
      null,
      "no",
    ]);
  });

  it("orders not set first, then marked, by name, and away members last", () => {
    const row = (uid: number, name: string, away = false) => ({ uid, name, away });
    const order = callOrder(
      [row(1, "Bo"), row(2, "Ana"), row(3, "Cy", true), row(4, "Dee")],
      marks([[2, "yes"]]),
      "en",
    );
    expect(order.map((m) => m.name)).toEqual(["Bo", "Dee", "Ana", "Cy"]);
  });

  it("leaves a member out only on the days their away note runs, or while on a break", () => {
    const away = { text: "", from: "2026-11-20", until: "2026-11-22" };
    expect(
      ["2026-11-19", "2026-11-20", "2026-11-22", "2026-11-23"].map((d) => awayUntil(away, d)),
    ).toEqual([null, "2026-11-22", "2026-11-22", null]);
    expect(awayUntil({ text: "", until: "2026-11-22" }, "2026-11-16")).toBe("2026-11-22");
    expect(
      awayOn({ status: { value: "break", source: "officer", version: 1 } }, "2026-11-16"),
    ).toEqual({ until: null });
    expect(awayOn({}, "2026-11-16")).toBeNull();
  });

  it("suggests daytime at the window first, then no time zone, then night; then activity", () => {
    const c = (uid: number, theirMinute: number | null, active: number | null) => ({
      uid,
      name: `P${uid}`,
      theirMinute,
      active,
      squad: null,
    });
    const order = teamOrder([c(1, 120, 900), c(2, null, 50), c(3, 600, 10), c(4, 900, 400)], "en");
    expect(order.map((x) => x.uid)).toEqual([4, 3, 2, 1]);
  });
});
